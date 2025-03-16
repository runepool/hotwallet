import { NostrService } from '@app/nostr';
import { DM } from '@app/nostr/constants';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Event } from 'nostr-tools';
import { Message, Pong } from './types';

import { PendingTransactionsService } from 'apps/hotwallet/src/pending-transactions/pending-transactions.service';
import { EventHandlerService } from './event-handler/event-handler.service';

export const MAKER_BONUS = 100;
export const PROTOCOL_FEE = 100;
export const PROTOCOL_FEE_OUTPUT = 'bc1pughzj2s7d2979z3vaf0reaszrx5pye9k8glwvvha7yh0nt64kgzsx83r0c';

@Injectable()
export class ExecutionService implements OnModuleInit {

    constructor(
        private readonly eventHandlerService: EventHandlerService,
        private readonly nostrService: NostrService,) { }

    async onModuleInit() {
        await this.nostrService.subscribeToEvent([
            {
                kinds: [DM],
                '#p': [this.nostrService.publicKey],
            }
        ], async (event: Event) => {
            try {
                const message: Message<any> = Object.assign(
                    new Message<any>(),
                    JSON.parse(event.content)
                );

                if (message.type === 'reserve_request') {
                    await this.eventHandlerService.handleReserveRequest(message, event);
                }

                if (message.type === 'sign_request') {
                    await this.eventHandlerService.handleSignRequest(message, event);
                }

                if (message.type === 'ping') {
                    await this.nostrService.publishDirectMessage(JSON.stringify(
                        Object.assign(new Message<Pong>(), {
                            type: 'pong',
                            data: {
                                timestamp: Date.now()
                            }
                        })), event.pubkey);
                }
            } catch (error) {
                console.error("Error", error);
                // Logger.error("Could not decode nostr event")
            }
        })
    }

}
