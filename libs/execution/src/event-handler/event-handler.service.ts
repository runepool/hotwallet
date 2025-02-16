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

@Injectable()
export class EventHandlerService {

    private reservedUtxos: {
        [utxo: string]: {
            tradeId: string,
            timestamp: number
        }
    } = {};

    constructor(
        @InjectEntityManager() private readonly manager: EntityManager,
        private readonly bitcoinService: BlockchainService,
        private readonly runeService: RunesService,
        private readonly walletService: BitcoinWalletService,
        private readonly nostrService: NostrService) {
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async clearReservedUtxos() {
        const RESERVATION_TIMEOUT = 2 * 60 * 1000; // 5 minutes in milliseconds
        const now = Date.now();
        
        for (const [utxo, reservation] of Object.entries(this.reservedUtxos)) {
            if (now - reservation.timestamp > RESERVATION_TIMEOUT) {
                delete this.reservedUtxos[utxo];
            }
        }
    }

    async handleSignRequest(message: Message<SignRequest>, event: Event) {
        const data = message.data;
        const psbt = Psbt.fromBase64(data.psbtBase64);
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
            // TODO: implement lock await h
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
        } catch (error) {
           console.log(error);
            await this.nostrService.publishDirectMessage(JSON.stringify(
                Object.assign(new Message<ReserveOrdersResponse>(), {
                    type: 'reserve_response',
                    data: {
                        tradeId: message.data.tradeId,
                        status: 'error'
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
            selectedOrders.push({
                order,
                usedAmount: BigInt(orderFill.amount)
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
        const avgPrice = selectedOrders.reduce((prev, curr) => prev += Number(curr.order.price), 0) / selectedOrders.length;
        const pendingTx = new Transaction();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}`).join(",");
        pendingTx.amount = runeAmount;
        pendingTx.tradeId = fillOrderRequest.tradeId;
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = selectedOrders[0].order.rune;
        pendingTx.status = TransactionStatus.PENDING;
        pendingTx.reservedUtxos = reservedUtxos.join(",");
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
            const utxo = utxos.pop();
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

}
