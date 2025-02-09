import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { SignableInput } from '@app/blockchain/bitcoin/types/UnspentOutput';
import { RunesService } from '@app/blockchain/runes/runes.service';
import { RuneOrder } from '@app/exchange-database/entities/rune-order.entity';
import { DM } from '@app/execution';
import { ReserveOrdersResponse, ReserveOrdersRequest, Message, SignResponse, SignRequest } from '@app/execution/types';
import { NostrService } from '@app/nostr';
import { Injectable } from '@nestjs/common';
import { Psbt } from 'bitcoinjs-lib';
import { Event } from 'nostr-tools';


@Injectable()
export class MakerGatewayService {

    constructor(
        private readonly nostrService: NostrService,
        private readonly runeService: RunesService,
    ) { }

    async signPsbt(swapPsbt: Psbt, inputsToSign: SignableInput[], orders: RuneOrder[], tradeId: string): Promise<Psbt> {
        const base64EcondedPsbt = swapPsbt.toBase64();

        const partials: Promise<SignResponse>[] = [];
        for (const order of orders) {
            partials.push(new Promise((resolve) => {
                this.nostrService.subscribeToOneEvent([
                    {
                        kinds: [DM],
                        '#p': [this.nostrService.publicKey],
                    }
                ], async (event: Event) => {
                    try {
                        const message = JSON.parse(event.content) as Message<SignResponse>;
                        if (message.type === 'sign_response') {
                            resolve(message.data);
                        }
                    } catch (error) {
                        resolve({
                            status: 'error',
                            tradeId,
                            signedPsbtBase64: null
                        });
                    }
                })

                this.nostrService.publishDirectMessage(JSON.stringify({
                    type: 'sign_request',
                    data: {
                        inputsToSign,
                        tradeId,
                        psbtBase64: base64EcondedPsbt
                    }
                } as Message<SignRequest>), order.makerNostrKey);

            }))
        }

        const psbts = await Promise.all(partials).then(results => {
            return results.map(result => Psbt.fromBase64(result.signedPsbtBase64));
        });

        const combinedPsbt = psbts.reduce((prev, curr) => {
            if (prev) {
                return prev.combine(curr);
            } else {
                return curr;
            }
        }, undefined);

        return combinedPsbt;
    }

    async reserveOrder(runeOrder: RuneOrder, orderAmount: bigint, tradeId: string): Promise<ReserveOrdersResponse> {
        return new Promise<ReserveOrdersResponse>(async (resolve) => {
            this.nostrService.subscribeToOneEvent([
                {
                    kinds: [DM],
                    '#p': [this.nostrService.publicKey],
                    since: Date.now() / 1000
                }
            ], async (event: Event) => {
                try {
                    const message = JSON.parse(event.content) as Message<any>;
                    if (message.type === 'reserve_response') {
                        resolve(message.data);
                    }
                } catch (error) {
                    resolve({
                        status: 'error',
                        tradeId
                    });
                }
            })

            await new Promise<void>((res) => {
                setTimeout(() => {
                    res();
                }, 200);
            })
            this.nostrService.publishDirectMessage(JSON.stringify({
                type: 'reserve_request',
                data: {
                    orders: [{
                        amount: orderAmount.toString(),
                        orderId: runeOrder.id
                    }],
                    tradeId
                }
            } as Message<ReserveOrdersRequest>), runeOrder.makerNostrKey.slice(2));

        })
    }
}
