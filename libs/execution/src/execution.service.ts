import { WebSocketService } from '@app/websocket';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Message, Pong } from './types';

import { EventHandlerService } from './event-handler/event-handler.service';

export const MAKER_BONUS = 100;
export const PROTOCOL_FEE = 100;
export const PROTOCOL_FEE_OUTPUT = 'bc1pughzj2s7d2979z3vaf0reaszrx5pye9k8glwvvha7yh0nt64kgzsx83r0c';

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
                    await this.eventHandlerService.handleReserveCancel(message, event);
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
