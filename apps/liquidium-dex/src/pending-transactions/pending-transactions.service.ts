import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { RuneOrder } from '@app/database/entities/rune-order';
import { TransactionStatus } from '@app/database/entities/transactions';
import { RuneOrdersService } from '@app/database/rune-orders/rune-orders.service';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PendingTransactionsService {
    constructor(
        private readonly service: TransactionsDbService,
        private readonly bitcoinService: BitcoinService,
        private readonly orderService: RuneOrdersService
    ) { }

    // Cron job to process pending transactions every minute
    @Cron(CronExpression.EVERY_MINUTE)
    async handlePendingTransactions() {
        Logger.log('Running cron job to manage pending transactions...');

        // Fetch all pending transactions
        const pendingTransactions = await this.service.findPendingAndConfirming()

        const ordersToUpdate: Promise<RuneOrder>[] = [] as any;
        const transactionsToUpdate = [];
        const transactionsToDelete: string[] = [];
        const currentBlock = await this.bitcoinService.getTipHeight();
        for (const transaction of pendingTransactions) {
            // Give txs time to propagate
            if (transaction.createdAt.getTime() > Date.now() - 30_000) continue;
            try {
                const tx = await this.bitcoinService.getTxInfo(transaction.txid).catch(err => null);
                // Reset the order amounts
                if (!tx || !tx.status) {
                    if (transaction.status === TransactionStatus.CONFIRMING) {
                        const orders = transaction.orders.split(",").map(async item => {
                            const [id, amount] = item.split(":");
                            const order = await this.orderService.getOrderById(id);
                            order.filledQuantity -= BigInt(amount);
                            return order;
                        });
                        ordersToUpdate.push(...orders)
                        transaction.status = TransactionStatus.ERRORED;
                        transactionsToUpdate.push(transaction);
                    } else {
                        transactionsToDelete.push(transaction.id);
                    }
                    continue;
                }

                transaction.confirmations = tx.status.block_height ? currentBlock - tx.status.block_height + 1 : 0;
                transaction.status = TransactionStatus.CONFIRMING;
                if (transaction.confirmations >= 4) {
                    transaction.status = TransactionStatus.CONFIRMED;
                }

                transactionsToUpdate.push(transaction);
            } catch (error) {
                transactionsToDelete.push(transaction.id);
                Logger.error(`Error processing transaction ${transaction.id}: ${error.message}`);
            }
        }

        try {
            const orders = await Promise.all(ordersToUpdate);
            if (orders.length > 0) {
                await this.orderService.save(orders);
            }
            if (transactionsToUpdate.length > 0) {
                await this.service.save(transactionsToUpdate);
            }

            if (transactionsToDelete.length > 0) {
                await this.service.deleteBatch(transactionsToDelete)
            }
        } catch (error) {
            Logger.error(`Error updating transactions ${error}`);
        }
    }

}
