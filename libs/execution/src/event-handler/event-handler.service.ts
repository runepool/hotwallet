import { Transaction, TransactionStatus, TransactionType } from '@app/database/entities/transaction.entity';

import { NostrService } from '@app/nostr';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Psbt } from 'bitcoinjs-lib';
import { Event } from 'nostr-tools';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { Message, ReserveOrdersRequest, ReserveOrdersResponse, SignRequest, SignResponse } from '../types';
import { RunesService } from '@app/blockchain/runes/runes.service';
import { BlockchainService } from '@app/blockchain';
import { RuneOrder } from '@app/database/entities/rune-order.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Edict, Runestone } from 'runelib';

@Injectable()
export class EventHandlerService {

    private reservedUtxos: {
        [utxo: string]: {
            tradeId: string,
            timestamp: number
        }
    } = {};

    private locks: { [lockId: string]: boolean } = {};

    // Reservation timeout in milliseconds (30 seconds)
    private readonly RESERVATION_TIMEOUT = 30 * 1000;

    constructor(
        @InjectEntityManager() private readonly manager: EntityManager,
        private readonly bitcoinService: BlockchainService,
        private readonly runeService: RunesService,
        private readonly walletService: BitcoinWalletService,
        private readonly nostrService: NostrService) {

        // Set up periodic cleanup of expired reservations
        setInterval(() => this.cleanupExpiredReservations(), 10 * 1000); // Run every minute
    }

    /**
     * Cleans up expired UTXO reservations
     */
    private cleanupExpiredReservations() {
        const now = Date.now();
        const expiredUtxos = Object.entries(this.reservedUtxos)
            .filter(([_, data]) => now - data.timestamp >= this.RESERVATION_TIMEOUT)
            .map(([utxo]) => utxo);

        if (expiredUtxos.length > 0) {
            console.log(`Cleaning up ${expiredUtxos.length} expired UTXO reservations`);
            expiredUtxos.forEach(utxo => {
                delete this.reservedUtxos[utxo];
            });

            console.log(this.reservedUtxos);
        }
    }

    async handleSignRequest(message: Message<SignRequest>, event: Event) {
        const data = message.data;
        const psbt = Psbt.fromBase64(data.psbtBase64);
        await this.validatePsbt(psbt, data.tradeId);
        const pubkey = await this.walletService.getPublicKey();
        const signableInputs = data.inputsToSign.filter(input => input.signerAddress === pubkey);
        const signedPsbt = this.walletService.signPsbt(psbt, signableInputs.map(input => input.index));
        await this.nostrService.publishDirectMessage(JSON.stringify(
            Object.assign(new Message<SignResponse>(), {
                type: 'sign_response',
                data: {
                    tradeId: message.data.tradeId,
                    signedPsbtBase64: signedPsbt.toBase64()
                }
            })
        ), event.pubkey);
    }

    async handleReserveRequest(message: Message<ReserveOrdersRequest>, event: Event) {
        try {
            // Implement a simple lock mechanism
            const lockId = `reserve-${message.data.tradeId}`;
            if (this.locks && this.locks[lockId]) {
                throw new Error('Another reservation is in progress with this tradeId');
            }

            this.locks = this.locks || {};
            this.locks[lockId] = true;

            try {
                const reservedUtxos = await this.reserveOrders(message.data);
                await this.nostrService.publishDirectMessage(JSON.stringify(
                    Object.assign(new Message<ReserveOrdersResponse>(), {
                        type: 'reserve_response',
                        data: {
                            tradeId: message.data.tradeId,
                            status: 'success',
                            reservedUtxos
                        }
                    } as Message<ReserveOrdersResponse>)
                ), event.pubkey);
            } finally {
                // Always release the lock
                delete this.locks[lockId];
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during reservation';
            console.error(`Reserve error: ${errorMessage}`, error);

            await this.nostrService.publishDirectMessage(JSON.stringify(
                Object.assign(new Message<ReserveOrdersResponse>(), {
                    type: 'reserve_response',
                    data: {
                        tradeId: message.data.tradeId,
                        status: 'error',
                        reservedUtxos: [],
                        error: errorMessage
                    }
                } as Message<ReserveOrdersResponse>)
            ), event.pubkey);
        }
    }

    async reserveOrders(fillOrderRequest: ReserveOrdersRequest) {
        const selectedOrders = [];

        const ordersRepo = this.manager.getRepository(RuneOrder);
        for (const orderFill of fillOrderRequest.orders) {
            const order = await ordersRepo.findOne({ where: { id: orderFill.orderId } });
            if (!order) {
                throw new Error(`Order ${orderFill.orderId} not found`);
            }
            if (order.filledQuantity + BigInt(orderFill.amount) > order.quantity) {
                throw new Error(`Order ${orderFill.orderId} quantity exceeded`);
            }
            order.filledQuantity += BigInt(orderFill.amount);
            Logger.debug(`Order ${orderFill.orderId} filled quantity: ${order.filledQuantity}`);
            selectedOrders.push({
                order,
                usedAmount: BigInt(orderFill.amount),
                price: Number(order.price)
            });
        }

        const orderType = selectedOrders[0].order.type;

        let reservedUtxos: string[];
        if (orderType === 'ask') {
            reservedUtxos = await this.reserverAskUTXOs(fillOrderRequest.tradeId, selectedOrders);
        } else if (orderType === 'bid') {
            reservedUtxos = await this.reserveBidUTXOs(fillOrderRequest.tradeId, selectedOrders);
        }
        
        const runeAmount = selectedOrders.reduce((prev, curr) => prev += curr.usedAmount, 0n).toString();
        let satsAmount = selectedOrders.reduce((prev, curr) => prev += curr.usedAmount * BigInt(curr.order.price), 0n);
        const runeInfo = await this.runeService.getRuneInfo(selectedOrders[0].order.rune);

        satsAmount = satsAmount / BigInt(10 ** runeInfo.decimals);

        const avgPrice = selectedOrders.reduce((prev, curr) => prev += Number(curr.order.price), 0) / selectedOrders.length;
        const pendingTx = new Transaction();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}:${item.price}`).join(",");
        pendingTx.amount = runeAmount;
        pendingTx.satsAmount = satsAmount.toString();
        pendingTx.tradeId = fillOrderRequest.tradeId;
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = selectedOrders[0].order.rune;
        pendingTx.status = TransactionStatus.PENDING;
        pendingTx.type = selectedOrders[0].type === 'ask' ? TransactionType.BUY : TransactionType.SELL;
        pendingTx.reservedUtxos = reservedUtxos.join(";");
        const result = await this.manager.transaction(async manager => {
            await manager.save<RuneOrder>(selectedOrders.map(item => item.order));
            await manager.save(pendingTx);

            return reservedUtxos
        });

        return result;
    }
    
    async reserveBidUTXOs(tradeId: string, selectedOrders: { order: RuneOrder; usedAmount: bigint }[]): Promise<string[]> {
        const result = [];
        const runeInfo = await this.runeService.getRuneInfo(selectedOrders[0].order.rune);

        let totalAmount = selectedOrders.reduce((prev, curr) => prev += (curr.usedAmount * curr.order.price), 0n);
        totalAmount = totalAmount / BigInt(10 ** runeInfo.decimals);
        const address = await this.walletService.getAddress();
        const pubkey = await this.walletService.getPublicKey();
        let utxos = await this.bitcoinService.getValidFundingInputs(address, pubkey);
        utxos = utxos.filter(item => !Object.keys(this.reservedUtxos).includes(item.location));
        const availableAmount = utxos.reduce((prev, curr) => prev += BigInt(curr.amount), 0n);

        if (totalAmount > availableAmount) {
            throw new Error('Insufficient funds');
        }

        while (totalAmount > 0n) {
            const utxo = utxos.pop();
            if (!utxo) {
                throw new Error('No more UTXOs available');
            }
            totalAmount -= BigInt(utxo.amount);
            this.reservedUtxos[utxo.location] = { tradeId, timestamp: Date.now() };
            result.push(utxo.location);
        }
        return result;
    }

    async reserverAskUTXOs(tradeId: string, selectedOrders: { order: RuneOrder; usedAmount: bigint }[]): Promise<string[]> {
        const result = [];
        let totalAmount = BigInt(selectedOrders.reduce((prev, curr) => prev += (curr.usedAmount), 0n));
        const runeInfo = await this.runeService.getRuneInfo(selectedOrders[0].order.rune);
        const address = await this.walletService.getAddress();

        let utxos = await this.runeService.getRunesUnspentOutputs(address, runeInfo.rune_id);
        utxos = utxos.filter(item => !Object.keys(this.reservedUtxos).includes(item.location));
        const availableAmount = utxos.reduce((prev, curr) => {
            const runeIdIndex = curr.runeIds.findIndex(item => item === runeInfo.rune_id);
            if (runeIdIndex === -1) {
                return prev;
            }
            return prev + curr.runeBalances[runeIdIndex];
        }, 0n);

        if (totalAmount > availableAmount) {
            throw new Error('Insufficient funds');
        }

        while (totalAmount > 0n) {
            const utxo = utxos.shift();
            if (!utxo) {
                throw new Error('No more UTXOs available');
            }

            const runeIdIndex = utxo.runeIds.findIndex(item => item === runeInfo.rune_id);
            if (runeIdIndex === -1) {
                throw new Error('Rune not found in UTXO');
            }
            totalAmount -= utxo.runeBalances[runeIdIndex];
            this.reservedUtxos[utxo.location] = { tradeId, timestamp: Date.now() };
            result.push(utxo.location);
        }

        return result;
    }

    /**
     * Validates a PSBT against a specific trade ID
     * @param psbt The Partially Signed Bitcoin Transaction to validate
     * @param tradeId The trade ID to validate against
     * @throws Error if validation fails
     */
    async validatePsbt(psbt: Psbt, tradeId: string) {
        // Find the transaction record for this trade ID
        const transaction = await this.manager.getRepository(Transaction).findOne({ where: { tradeId } });

        if (!transaction) {
            throw new Error(`No transaction found for trade ID: ${tradeId}`);
        }

        if (transaction.status !== TransactionStatus.PENDING) {
            throw new Error(`Transaction is not in PENDING state: ${transaction.status}`);
        }

        // Get the reserved UTXOs for this transaction
        const reservedUtxos = transaction.reservedUtxos.split(';');

        // Extract input outpoints from the PSBT
        const psbtInputs = psbt.data.inputs.map((_, index) => {
            const input = psbt.txInputs[index];
            return `${input.hash.reverse().toString('hex')}:${input.index}`;
        });

        // Check if all reserved UTXOs are included in the PSBT inputs
        const usedUtxos = reservedUtxos.filter(utxo => psbtInputs.includes(utxo));


        // Additional validation could be added here, such as:
        // - Verifying output amounts match the expected trade amounts
        // - Checking that the PSBT doesn't contain unexpected inputs or outputs
        // - Validating fee rates are reasonable

        const wallet = await this.walletService.getAddress();
        if (transaction.type == TransactionType.BUY) {
            const makerOutput = psbt.txOutputs.reverse().find(output => output.address === wallet);
            if (!makerOutput) {
                throw new Error('Maker output not found in PSBT');
            }
            const makerReceivedSats = makerOutput.value;

            if (+transaction.satsAmount !== makerReceivedSats) {
                throw new Error('Maker received incorrect amount of sats');
            }
        } else {
            const edictIndex  = psbt.txOutputs.findIndex(output => output.value === 0);
            const makerOutputIndex = psbt.txOutputs.findIndex((output, index) => index < edictIndex && output.address === wallet);
            const edicts = Runestone.decipher(psbt.data.getTransaction().toString('hex')).value().edicts;
            const edict = edicts.find(edict => edict.output === makerOutputIndex);

            if (+transaction.amount !== Number(edict.amount)) {
                throw new Error('Maker received incorrect amount of rune');
            }
        }

        return true; // Validation passed
    }
}

