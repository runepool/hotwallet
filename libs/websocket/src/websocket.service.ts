import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as WebSocket from 'ws';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { DM } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { BitcoinWalletService } from '@app/wallet';

@Injectable()
export class WebSocketService implements OnModuleInit {
    private readonly logger = new Logger(WebSocketService.name);
    private messageCallbacks: Map<string, (message: any) => void> = new Map();
    private wsConnection: WebSocket;
    private serverUrl: string;
    private reconnectAttempts = 0;
    private reconnectTimeout: NodeJS.Timeout;

    // Client ID 
    public clientId: string;

    constructor(
        private readonly walletService: BitcoinWalletService,
        private readonly settingsService: DatabaseSettingsService) {
    }

    async onModuleInit() {
        // Get WebSocket URL from settings
        try {
            const settings = await this.settingsService.getSettings();
            this.serverUrl = settings.websocketUrl || 'wss://ws.runepool.io';
            this.logger.log(`Using WebSocket server URL: ${this.serverUrl}`);
            this.clientId = await this.walletService.getPublicKey();

            // Try to connect to the WebSocket server
            try {
                await this.connectToServer();
                this.logger.log('Successfully connected to WebSocket server');
            } catch (error) {
                this.logger.error(`Failed to connect to WebSocket server: ${error.message}`);
                this.scheduleReconnect();
            }
        } catch (error) {
            this.logger.error(`Failed to get WebSocket URL from settings: ${error.message}`);
            this.serverUrl = process.env.WS_URL || 'wss://ws.runepool.io';
            this.scheduleReconnect();
        }
    }

    // Connect to a WebSocket server
    async connectToServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.wsConnection = new WebSocket(this.serverUrl);

                this.wsConnection.on('open', () => {
                    this.reconnectAttempts = 0;
                    // Register with the server
                    this.wsConnection.send(JSON.stringify({
                        type: 'register',
                        clientId: this.clientId
                    }));
                    this.logger.log(`Connected to WebSocket server at ${this.serverUrl}`);
                    resolve();
                });

                this.wsConnection.on('message', (message: string) => {
                    try {
                        const parsedMessage = JSON.parse(message.toString());
                        // Handle messages
                        if (parsedMessage.type === 'message') {
                            this.handleIncomingMessage(parsedMessage.content, parsedMessage.sender);
                        } else if (parsedMessage.type === 'register_confirm') {
                            this.logger.log(`Registration confirmed with server, client ID: ${parsedMessage.clientId}`);
                        }
                    } catch (error) {
                        this.logger.error(`Error processing message: ${error.message}`);
                    }
                });

                this.wsConnection.on('error', (error) => {
                    this.logger.error(`WebSocket connection error: ${error.message}`);
                    reject(error);
                });

                this.wsConnection.on('close', () => {
                    this.logger.warn('WebSocket connection closed');
                    this.scheduleReconnect();
                });
            } catch (error) {
                this.logger.error(`Failed to create WebSocket connection: ${error.message}`);
                reject(error);
            }
        });
    }

    private scheduleReconnect(): void {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        this.logger.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = setTimeout(async () => {
            try {
                await this.connectToServer();
            } catch (error) {
                this.logger.error(`Reconnect attempt failed: ${error.message}`);
                this.scheduleReconnect();
            }
        }, delay);
    }

    private handleIncomingMessage(message: any, sender: string) {
        // Create a simplified event object
        const event = {
            timestamp: Date.now(),
            content: message,
            recipient: this.clientId
        };

        // Find and execute any registered callbacks
        for (const [filter, callback] of this.messageCallbacks.entries()) {
            const filterObj = JSON.parse(filter);

            // Check if the event matches the filter
            if (this.eventMatchesFilter(event, filterObj)) {
                callback(event);
            }
        }
    }

    private eventMatchesFilter(event: any, filter: any): boolean {
        // Basic filter matching logic
        if (filter.recipient && filter.recipient !== event.recipient) {
            return false;
        }

        return true;
    }

    // Subscribe to events with a one-time callback
    subscribeToOneEvent(filters: any, callback: any) {
        const filterId = JSON.stringify(filters);
        const callbackWrapper = (event: any) => {
            callback(event, {
                close: () => {
                    this.messageCallbacks.delete(filterId);
                }
            });
        };

        this.messageCallbacks.set(filterId, callbackWrapper);

        return {
            close: () => {
                this.messageCallbacks.delete(filterId);
            }
        };
    }

    // Subscribe to events with a persistent callback
    async subscribeToEvent(filters: any, callback: any): Promise<void> {
        const filterId = JSON.stringify(filters);
        this.messageCallbacks.set(filterId, callback);
    }

    // Send a direct message to another client
    async publishDirectMessage(content: string): Promise<void> {
        if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
            try {
                await this.connectToServer();
            } catch (error) {
                this.logger.error(`Failed to connect to server before sending message: ${error.message}`);
                throw error;
            }
        }

        try {
            this.wsConnection.send(JSON.stringify({
                type: 'message',
                sender: this.clientId,
                content: content
            }));
            this.logger.debug(`Sent message`);
        } catch (error) {
            this.logger.error(`Failed to send message: ${error.message}`);
            throw error;
        }
    }
}
