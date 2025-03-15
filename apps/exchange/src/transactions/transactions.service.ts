import { Transaction, TransactionStatus } from '@app/exchange-database/entities/transaction.entity';
import { TransactionsDbService } from '@app/exchange-database/transactions/transactions-database.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';

@Injectable()
export class TransactionsService {
    private readonly logger = new Logger(TransactionsService.name);

    constructor(
        private readonly transactionsDbService: TransactionsDbService,
        private readonly bitcoinService: BitcoinService,
    ) { }

    async create(createTransactionDto: Partial<Transaction>): Promise<Transaction> {
        return this.transactionsDbService.create(createTransactionDto);
    }

    async findAll(): Promise<Transaction[]> {
        return this.transactionsDbService.findAll();
    }

    async findOne(id: string): Promise<Transaction> {
        return this.transactionsDbService.findById(id);
    }

    async findByTxid(txid: string): Promise<Transaction> {
        return this.transactionsDbService.findByTxid(txid);
    }

    async remove(id: string): Promise<void> {
        await this.transactionsDbService.delete(id);
    }

    /**
     * Periodically checks the status of pending and confirming transactions
     * Updates their status based on blockchain information
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async checkPendingTransactions() {
        try {
            this.logger.debug('Checking pending transactions...');
            const pendingTransactions = await this.transactionsDbService.findPendingAndConfirming();
            
            if (pendingTransactions.length === 0) {
                return;
            }
            
            this.logger.debug(`Found ${pendingTransactions.length} pending/confirming transactions to check`);
            
            const tipHeight = await this.bitcoinService.getTipHeight();
            const updatedTransactions: Partial<Transaction>[] = [];
            
            for (const transaction of pendingTransactions) {
                // Skip transactions without txid (not yet broadcast)
                if (!transaction.txid) {
                    continue;
                }
                
                try {
                    // First try to fetch the transaction directly - if this fails, it's not in mempool or blockchain
                    try {
                        await this.bitcoinService.getTx(transaction.txid);
                    } catch (txError) {
                        // Transaction not found in mempool or blockchain
                        if (transaction.status === TransactionStatus.PENDING) {
                            this.logger.warn(`Transaction ${transaction.id} (${transaction.txid}) not found in mempool, marking as errored`);
                            updatedTransactions.push({
                                id: transaction.id,
                                status: TransactionStatus.ERRORED
                            });
                            continue;
                        }
                    }
                    
                    // If we get here, the transaction exists, so check its status
                    const txStatus = await this.bitcoinService.getTxStatus(transaction.txid);
                    
                    // Transaction not found or errored
                    if (!txStatus) {
                        // If transaction has been pending for too long, mark as errored
                        const ageInHours = (Date.now() - new Date(transaction.createdAt).getTime()) / (1000 * 60 * 60);
                        if (ageInHours > 24) {
                            this.logger.warn(`Transaction ${transaction.id} (${transaction.txid}) has been pending for over 24 hours, marking as errored`);
                            updatedTransactions.push({
                                id: transaction.id,
                                status: TransactionStatus.ERRORED
                            });
                        }
                        continue;
                    }
                    
                    // Transaction found in mempool but not confirmed yet
                    if (!txStatus.confirmed) {
                        if (transaction.status !== TransactionStatus.CONFIRMING) {
                            this.logger.log(`Transaction ${transaction.id} (${transaction.txid}) found in mempool, updating status to confirming`);
                            updatedTransactions.push({
                                id: transaction.id,
                                status: TransactionStatus.CONFIRMING,
                                confirmations: 0
                            });
                        }
                        continue;
                    }
                    
                    // Transaction is confirmed, calculate confirmations
                    const confirmations = tipHeight - txStatus.block_height + 1;
                    
                    // Update transaction with confirmation count
                    if (transaction.confirmations !== confirmations) {
                        const newStatus = confirmations >= 3 ? TransactionStatus.CONFIRMED : TransactionStatus.CONFIRMING;
                        
                        this.logger.log(`Transaction ${transaction.id} (${transaction.txid}) has ${confirmations} confirmations, updating status to ${newStatus}`);
                        
                        updatedTransactions.push({
                            id: transaction.id,
                            status: newStatus,
                            confirmations
                        });
                    }
                } catch (error) {
                    this.logger.error(`Error checking transaction ${transaction.id} (${transaction.txid}): ${error.message}`);
                }
            }
            
            // Save all updated transactions in a batch
            if (updatedTransactions.length > 0) {
                await this.transactionsDbService.save(updatedTransactions);
                this.logger.log(`Updated ${updatedTransactions.length} transactions`);
            }
        } catch (error) {
            this.logger.error(`Error in checkPendingTransactions: ${error.message}`);
        }
    }
}
