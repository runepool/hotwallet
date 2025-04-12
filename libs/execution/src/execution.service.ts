import { WebSocketService } from '@app/websocket';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Message, Pong } from './types';

import { EventHandlerService } from './event-handler/event-handler.service';

export const MAKER_BONUS = 100;
export const PROTOCOL_FEE = 100;
export const PROTOCOL_FEE_OUTPUT = 'bc1pk6zlfs8qd8q9qrremtzuwz3auwk4zts2evpjuhm2y3en8wjtuu9qr00smw';

@Injectable()
export class ExecutionService implements OnModuleInit {

    constructor(
        private readonly eventHandlerService: EventHandlerService,
        private readonly webSocketService: WebSocketService,) { }

    async onModuleInit() {
        await this.webSocketService.subscribeToEvent({
            recipient: this.webSocketService.clientId
        }, async (event: any) => {
            try {
                const message: Message<any> = Object.assign(
                    new Message<any>(),
                    JSON.parse(event.content)
                );

                if (message.type === 'reserve_request') {
                    await this.eventHandlerService.handleReserveRequest(message, event);
                    return;
                }

                if (message.type === 'reserve_cancel') {
                    await this.eventHandlerService.handleReserveCancel(message.data.tradeId);
                    return;
                }


                if (message.type === 'sign_request') {
                    await this.eventHandlerService.handleSignRequest(message, event);
                    return;
                }

                if (message.type === 'ping') {
                    await this.webSocketService.publishDirectMessage(JSON.stringify(
                        Object.assign(new Message<Pong>(), {
                            type: 'pong',
                            data: {
                                timestamp: Date.now()
                            }
                        })));

                }
            } catch (error) {
                console.error("Error", error);
                // Error handling for WebSocket events
            }
        })
    }

}
