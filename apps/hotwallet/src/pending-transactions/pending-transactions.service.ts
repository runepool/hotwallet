import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RuneOrder, RuneOrderType } from '@app/database/entities/rune-order.entity';
import { RuneOrdersService } from '@app/database/rune-orders/rune-orders-database.service';
import { TransactionStatus, TransactionType } from '@app/database/entities/transaction.entity';
import { AutoRebalanceConfigService } from '@app/database/auto-rebalance/auto-rebalance.service';
import { OrderStatus } from '@app/exchange-database/entities/rune-order.entity';

@Injectable()
export class PendingTransactionsService {
    private isProcessing = false;
    constructor(
        private readonly service: TransactionsDbService,
        private readonly bitcoinService: BitcoinService,
        private readonly orderService: RuneOrdersService,
        private readonly autoRebalanceConfigService: AutoRebalanceConfigService
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

        // We create new orders if rebalance strategy is in place
        const newOrders: RuneOrder[] = [];
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
                            // Ensure it doesn't go below zero
                            if (ordersToUpdate[orderIndex].filledQuantity < BigInt(0)) {
                                ordersToUpdate[orderIndex].filledQuantity = BigInt(0);
                            }
                        }
                    }
                    transactionsToDelete.push(transaction.id);
                    continue;
                }

                transaction.confirmations = txInfo.status.block_height ? currentBlock - txInfo.status.block_height + 1 : 0;
                transaction.status = TransactionStatus.CONFIRMING;
                if (transaction.confirmations >= 1 && transaction.status !== TransactionStatus.CONFIRMED) {
                    transaction.status = TransactionStatus.CONFIRMED;

                    const config = await this.autoRebalanceConfigService.get(transaction.rune);
                    if (config && config.enabled) {

                        const orders: any = transaction.orders.split(",").map((order) => {
                            const [id, amount, price] = order.split(":");
                            const spread = +config.spread;
                            let newPrice: number;

                            if (transaction.type === TransactionType.BUY) {
                                newPrice = +price * (1 - spread / 100);
                            } else {
                                newPrice = +price * (1 + spread / 100);
                            }

                            return ({
                                rune: transaction.rune,
                                price: BigInt(Math.ceil(newPrice)),
                                quantity: BigInt(amount),
                                status: OrderStatus.OPEN,
                                type: transaction.type === TransactionType.SELL ? RuneOrderType.BID : RuneOrderType.ASK
                            });
                        });

                        newOrders.push(...orders);
                    }
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

            if (newOrders.length > 0) {
                await this.orderService.save(newOrders);
            }
        } catch (error) {
            Logger.error(`Error updating transactions ${error}`);
        }
        this.isProcessing = false;
    }

}
