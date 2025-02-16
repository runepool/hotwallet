import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RuneOrder } from '@app/database/entities/rune-order.entity';
import { RuneOrdersService } from '@app/database/rune-orders/rune-orders-database.service';
import { TransactionStatus } from '@app/database/entities/transaction.entity';

@Injectable()
export class PendingTransactionsService {
    private isProcessing = false;
    constructor(
        private readonly service: TransactionsDbService,
        private readonly bitcoinService: BitcoinService,
        private readonly orderService: RuneOrdersService
    ) {

        setTimeout(() => {
            this.handlePendingTransactions();
        }, 1000);
     }

    // Cron job to process pending transactions every minute
    @Cron(CronExpression.EVERY_MINUTE)
    async handlePendingTransactions() {
        Logger.log('Running cron job to manage pending transactions...');
        if (this.isProcessing) return;
        this.isProcessing = true;
        // Fetch all pending transactions
        const pendingTransactions = await this.service.findPendingAndConfirming()

        const ordersToUpdate: RuneOrder[] = [] as any;
        const transactionsToUpdate = [];
        const transactionsToDelete: string[] = [];
        const currentBlock = await this.bitcoinService.getTipHeight();
        for (const transaction of pendingTransactions) {
            // Give txs time to propagate
            if (transaction.createdAt.getTime() > Date.now() - 30_000) continue;
            try {
                const utxo = transaction.reservedUtxos.split(";")[0];
                const txInfo = await this.bitcoinService.getOutspend(utxo).catch(err => null);
                // Reset the order amounts
                if (txInfo && !txInfo.spent) {
                    const orders = transaction.orders.split(",");

                    for (const item of orders) {
                        const [id, amount] = item.split(":");
                        let orderIndex: any = ordersToUpdate.findIndex(order => order.id === id);
                        let order;
                        if (orderIndex === -1) {
                            order = await this.orderService.getOrderById(id);
                            order.filledQuantity -= BigInt(amount);
                            ordersToUpdate.push(order);
                        } else {
                            ordersToUpdate[orderIndex].filledQuantity -= BigInt(amount);
                        }
                    }
                    transactionsToDelete.push(transaction.id);
                    continue;
                }

                transaction.confirmations = txInfo.status.block_height ? currentBlock - txInfo.status.block_height + 1 : 0;
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
        this.isProcessing = false;
    }

}
