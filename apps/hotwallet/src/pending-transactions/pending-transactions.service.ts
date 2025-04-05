import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RuneOrder, RuneOrderType } from '@app/database/entities/rune-order.entity';
import { RuneOrdersService } from '@app/database/rune-orders/rune-orders-database.service';
import { TransactionStatus, TransactionType } from '@app/database/entities/transaction.entity';
import { AutoRebalanceConfigService } from '@app/database/auto-rebalance/auto-rebalance.service';
import { OrderStatus } from '../../../../../rune-pool-exchange/libs/exchange-database/src/entities/rune-order.entity';

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
    @Cron(CronExpression.EVERY_30_SECONDS)
    async handlePendingTransactions() {
        Logger.log('Running cron job to manage pending transactions...');
        if (this.isProcessing) {
            Logger.log('Previous job still processing, skipping...');
            return;
        }
        this.isProcessing = true;
        // Fetch all pending transactions
        const pendingTransactions = await this.service.findPendingAndConfirming();
        Logger.log(`Found ${pendingTransactions.length} pending/confirming transactions to process`);

        const ordersToUpdate: RuneOrder[] = [] as any;
        const transactionsToUpdate = [];
        const transactionsToDelete: string[] = [];
        const currentBlock = await this.bitcoinService.getTipHeight();
        Logger.log(`Current block height: ${currentBlock}`);

        // We create new orders if rebalance strategy is in place
        const newOrders: RuneOrder[] = [];
        for (const transaction of pendingTransactions) {
            // Give txs time to propagate
            if (transaction.createdAt.getTime() > Date.now() - 60_000) {
                Logger.debug(`Skipping transaction ${transaction.id} (tradeId: ${transaction.tradeId}) - too recent (${Math.floor((Date.now() - transaction.createdAt.getTime()) / 1000)}s old)`);
                continue;
            }
            
            Logger.debug(`Processing transaction ${transaction.id} (tradeId: ${transaction.tradeId}) - status: ${transaction.status}, type: ${transaction.type}`);
            try {
                const utxo = transaction.reservedUtxos.split(";")[0];
                Logger.debug(`Checking UTXO ${utxo} for transaction ${transaction.id}`);
                const txInfo = await this.bitcoinService.getOutspend(utxo).catch(err => {
                    Logger.error(`Error checking outspend for UTXO ${utxo}: ${err.message}`);
                    return null;
                });
                
                // Reset the order amounts if UTXO is not spent (transaction didn't go through)
                if (txInfo && !txInfo.spent) {
                    Logger.debug(`UTXO ${utxo} is not spent, resetting order amounts for transaction ${transaction.id}`);
                    const orders = transaction.orders.split(",");
                    Logger.debug(`Found ${orders.length} orders to reset for transaction ${transaction.id}`);

                    for (const item of orders) {
                        const [id, amount] = item.split(":");
                        let orderIndex: any = ordersToUpdate.findIndex(order => order.id === id);
                        let order;
                        if (orderIndex === -1) {
                            order = await this.orderService.getOrderById(id);
                            const oldAmount = order.filledQuantity;
                            order.filledQuantity -= BigInt(amount);
                            Logger.debug(`Resetting order ${id} filled quantity from ${oldAmount} to ${order.filledQuantity} (decrease by ${amount})`);
                            ordersToUpdate.push(order);
                        } else {
                            const oldAmount = ordersToUpdate[orderIndex].filledQuantity;
                            ordersToUpdate[orderIndex].filledQuantity -= BigInt(amount);
                            // Ensure it doesn't go below zero
                            if (ordersToUpdate[orderIndex].filledQuantity < BigInt(0)) {
                                Logger.warn(`Order ${id} filled quantity went below zero, setting to 0`);
                                ordersToUpdate[orderIndex].filledQuantity = BigInt(0);
                            }
                            Logger.debug(`Resetting order ${id} filled quantity from ${oldAmount} to ${ordersToUpdate[orderIndex].filledQuantity} (decrease by ${amount})`);
                        }
                    }
                    Logger.debug(`Marking transaction ${transaction.id} for deletion`);
                    transactionsToDelete.push(transaction.id);
                    continue;
                }

                transaction.confirmations = txInfo.status.block_height ? currentBlock - txInfo.status.block_height + 1 : 0;
                transaction.txid = txInfo.txid;
                Logger.debug(`Transaction ${transaction.id} has ${transaction.confirmations} confirmations, txid: ${transaction.txid}`);
                
                transaction.status = TransactionStatus.CONFIRMING;
                if (transaction.confirmations >= 1 && transaction.status !== TransactionStatus.CONFIRMED) {
                    Logger.debug(`Marking transaction ${transaction.id} as CONFIRMED (${transaction.confirmations} confirmations)`);
                    transaction.status = TransactionStatus.CONFIRMED;

                    const config = await this.autoRebalanceConfigService.get(transaction.rune);
                    if (config && config.enabled) {
                        Logger.debug(`Auto-rebalance is enabled for rune ${transaction.rune} with spread ${config.spread}%`);

                        for (const order of transaction.orders.split(",")) {
                            const [id, amount, price] = order.split(":");
                            const spread = +config.spread;
                            let newPrice: number;

                            if (transaction.type === TransactionType.BUY) {
                                newPrice = +price * (1 + spread / 100);
                                Logger.debug(`Creating new ASK order with price ${newPrice} (original: ${price}, spread: +${spread}%)`);
                            } else {
                                newPrice = +price * (1 - spread / 100);
                                Logger.debug(`Creating new BID order with price ${newPrice} (original: ${price}, spread: -${spread}%)`);
                            }


                            const savedOrder = await this.orderService.getOrderById(id);
                            if (savedOrder.filledQuantity === savedOrder.quantity) {
                                Logger.debug(`Order ${id} is fully filled, marking as CLOSED`);
                                const index = ordersToUpdate.findIndex(order => order.id === id);
                                if (index !== -1) {
                                    ordersToUpdate[index].status = OrderStatus.CLOSED;
                                } else {
                                    savedOrder.status = OrderStatus.CLOSED;
                                    ordersToUpdate.push(savedOrder);
                                }
                            }
                            
                            const newOrderType = transaction.type === TransactionType.SELL ? RuneOrderType.BID : RuneOrderType.ASK;
                            Logger.debug(`Creating new ${newOrderType} order for rune ${transaction.rune} with quantity ${amount} and price ${Math.ceil(newPrice)}`);
                            
                            newOrders.push({
                                rune: transaction.rune,
                                price: BigInt(Math.ceil(newPrice)),
                                quantity: BigInt(amount),
                                status: OrderStatus.OPEN,
                                type: newOrderType
                            } as any);
                        }

                    }
                }

                transactionsToUpdate.push(transaction);
                Logger.debug(`Added transaction ${transaction.id} to update queue`);
            } catch (error) {
                transactionsToDelete.push(transaction.id);
                Logger.error(`Error processing transaction ${transaction.id}: ${error.message}`);
                Logger.error(`Stack trace: ${error.stack}`);
            }
        }

        try {
            const orders = await Promise.all(ordersToUpdate);
            if (orders.length > 0) {
                Logger.log(`Saving ${orders.length} updated orders`);
                await this.orderService.save(orders);
            }
            if (transactionsToUpdate.length > 0) {
                Logger.log(`Saving ${transactionsToUpdate.length} updated transactions`);
                await this.service.save(transactionsToUpdate);
            }

            if (transactionsToDelete.length > 0) {
                Logger.log(`Deleting ${transactionsToDelete.length} transactions`);
                await this.service.deleteBatch(transactionsToDelete);
            }

            if (newOrders.length > 0) {
                Logger.log(`Creating ${newOrders.length} new orders from auto-rebalance`);
                await this.orderService.save(newOrders);
            }
            
            Logger.log(`Pending transactions job completed: ${orders.length} orders updated, ${transactionsToUpdate.length} transactions updated, ${transactionsToDelete.length} transactions deleted, ${newOrders.length} new orders created`);
        } catch (error) {
            Logger.error(`Error updating transactions: ${error.message}`);
            Logger.error(`Stack trace: ${error.stack}`);
        }
        this.isProcessing = false;
    }

}
