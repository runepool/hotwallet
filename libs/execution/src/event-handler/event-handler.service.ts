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
import { UnspentOutput } from '@app/blockchain/bitcoin/types/UnspentOutput';
import { RuneOrder } from '@app/database/entities/rune-order.entity';

@Injectable()
export class EventHandlerService {

    private reservedUtxos: { [utxo: string]: string } = {};

    constructor(
        @InjectEntityManager() private readonly manager: EntityManager,
        private readonly bitcoinService: BlockchainService,
        private readonly runeService: RunesService,
        private readonly walletService: BitcoinWalletService,
        private readonly nostrService: NostrService) { }

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
            await this.reserveOrders(message.data);
            await this.nostrService.publishDirectMessage(JSON.stringify(
                Object.assign(new Message<ReserveOrdersResponse>(), {
                    type: 'reserve_response',
                    data: {
                        tradeId: message.data.tradeId,
                        status: 'success'
                    }
                } as Message<ReserveOrdersResponse>)
            ), event.pubkey);
        } catch (error) {
            Logger.error(error);
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

        // TODO: Reserve UTXOs
        const orderType = selectedOrders[0].type;

        if (orderType === 'ask') {
            await this.reserverAskUTXOs(fillOrderRequest.tradeId, selectedOrders);
        } else if (orderType === 'bid') {
            await this.reserveBidUTXOs(fillOrderRequest.tradeId, selectedOrders);
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
        pendingTx.type = selectedOrders[0].type === 'ask' ? TransactionType.BUY : TransactionType.SELL;
        return this.manager.transaction(async manager => {
            await manager.save<RuneOrder>(selectedOrders.map(item => item.order));
            await manager.save(pendingTx);
        });
    }
    async reserveBidUTXOs(tradeId: string, selectedOrders: { order: RuneOrder; usedAmount: bigint }[]) {
        let totalAmount = selectedOrders.reduce((prev, curr) => prev += (curr.usedAmount), 0n);

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
            this.reservedUtxos[utxo.location] = tradeId;
        }
    }

    async reserverAskUTXOs(tradeId: string, selectedOrders: { order: RuneOrder; usedAmount: bigint }[]) {
        let totalAmount = BigInt(selectedOrders.reduce((prev, curr) => prev += (curr.usedAmount * curr.order.price), 0n));
        const runeInfo = await this.runeService.getRuneInfo(selectedOrders[0].order.rune);

        const address = await this.walletService.getAddress();

        let utxos = await this.runeService.getRunesUnspentOutputs(address, runeInfo.rune_id);
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
            this.reservedUtxos[utxo.location] = tradeId;
        }

    }

}
