import { RuneFillRequest } from '@app/engine/types';
import { NostrService } from '@app/nostr';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Event } from 'nostr-tools';
import { FillRuneOrderOffer, Message, ReserveOrdersResponse, SwapResult, SwapTransaction } from './types';

import { EventHandlerService } from './event-handler/event-handler.service';

export const DM = 4;
export const MAKER_BONUS = 100;
export const PROTOCOL_FEE = 100;
export const PROTOCOL_FEE_OUTPUT = 'bc1pughzj2s7d2979z3vaf0reaszrx5pye9k8glwvvha7yh0nt64kgzsx83r0c';


@Injectable()
export class ExecutionService implements OnModuleInit {

    constructor(
        private readonly eventHandlerService: EventHandlerService,
        private readonly nostrService: NostrService) { }

    onModuleInit() {
        this.nostrService.subscribeToEvent([
            {
                kinds: [DM],
                '#p': [this.nostrService.publicKey],
            }
        ], async (event: Event) => {
            try {
                const message: Message<any> = Object.assign(
                    new Message<any>(),
                    JSON.parse(Buffer.from(event.content, 'base64').toString('utf-8'))
                );

                if (message.type === 'reserve_request') {
                    await this.eventHandlerService.handleReserveRequest(message, event);
                }

                if (message.type === 'sign_request') {
                    await this.eventHandlerService.handleSignRequest(message, event);
                }
            } catch (error) {
                console.log("Error", error);
                // Logger.error("Could not decode nostr event")
            }
        })

        // this.nostrService.subscribeToEvent([
        //     {
        //         kinds: [DM],
        //         '#p': [this.nostrService.publicKey],
        //     }
        // ], async (event: Event) => {
        //     try {
        //         const swapData = this.nostrService.decryptEventContent(event);
        //         const result = await this.finalize(JSON.parse(swapData));

        //         Logger.log("Finalized swap:", result);
        //         await this.nostrService.publishDirectMessage(JSON.stringify({
        //             type: 'result',
        //             data: result
        //         } as Message<SwapResult>
        //         ), event.pubkey);

        //     } catch (error) {
        //         console.log("Error", error);

        //         const result = {
        //             status: 'error',
        //             error: 'Could not finalize swap'
        //         } as SwapResult

        //         await this.nostrService.publishDirectMessage(JSON.stringify({
        //             type: 'result',
        //             data: result
        //         } as Message<SwapResult>), event.pubkey);
        //     }
        // })
    }


    // async finalize(swap: SwapTransaction): Promise<SwapResult> {
    //     const psbt = Psbt.fromBase64(swap.signedBase64Psbt);
    //     const tx = psbt.extractTransaction();
    //     const transactionRepo = this.manager.getRepository(Transaction);
    //     const orderRepo = this.manager.getRepository(RuneOrder);
    //     const transaction = await transactionRepo.findOne({ where: { id: swap.offerId } });

    //     if (!transaction) {
    //         throw "Transaction not found";
    //     }

    //     const txid = await this.bitcoinService.broadcast(tx.toHex());

    //     transaction.status = TransactionStatus.CONFIRMING;
    //     transaction.txid = txid;

    //     try {
    //         const orders = transaction.orders.split(",").map(async item => {
    //             const [id, amount] = item.split(":");
    //             const order = await orderRepo.findOne({ where: { id } });
    //             order.filledQuantity += BigInt(amount);
    //             return order;
    //         });

    //         await orderRepo.save(await Promise.all(orders))
    //         await transactionRepo.save(transaction);
    //     } catch (error) {
    //         Logger.error("Could not update pending orders")
    //     }

    //     return { txid, status: 'success' };

}

