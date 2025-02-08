import { Transaction, TransactionStatus, TransactionType } from '@app/database/entities/transaction.entity';
import { RuneOrder } from '@app/exchange-database/entities/rune-order.entity';
import { NostrService } from '@app/nostr';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Psbt } from 'bitcoinjs-lib';
import { Event } from 'nostr-tools';
import { EntityManager } from 'typeorm/entity-manager/EntityManager';
import { Message, ReserveOrdersRequest, ReserveOrdersResponse, SignRequest, SignResponse } from '../types';

@Injectable()
export class EventHandlerService {

    constructor(
        @InjectEntityManager() private readonly manager: EntityManager,
        private readonly walletService: BitcoinWalletService,
        private readonly nostrService: NostrService) { }

    async handleSignRequest(message: Message<SignRequest>, event: Event) {
        const data = message.data;
        const psbt = Psbt.fromBase64(data.psbtBase64);
        const pubkey = await this.walletService.getPublicKey();
        const signableInputs = data.inputsToSign.filter(input => input.signerAddress === pubkey);
        const signedPsbt  = this.walletService.signPsbt(psbt, signableInputs.map(input => input.index));
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
            selectedOrders.push(order);
        }

        // TODO: Reserve UTXOs
        const runeAmount = selectedOrders.reduce((prev, curr) => prev += curr.usedAmount, 0n).toString();
        const avgPrice = selectedOrders.reduce((prev, curr) => prev += curr.order.price, 0n) / selectedOrders.length;
        const pendingTx = new Transaction();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}`).join(",");
        pendingTx.amount = runeAmount;
        pendingTx.tradeId = fillOrderRequest.tradeId;
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = selectedOrders[0].rune;
        pendingTx.status = TransactionStatus.PENDING;
        pendingTx.type = selectedOrders[0].type === 'ask' ? TransactionType.BUY : TransactionType.SELL;
        return this.manager.transaction(async manager => {
            await manager.save(selectedOrders);
            await manager.save(pendingTx);
        });
    }

}
