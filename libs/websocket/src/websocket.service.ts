import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as WebSocket from 'ws';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { DM } from './constants';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebSocketService implements OnModuleInit {
    private readonly logger = new Logger(WebSocketService.name);
    private server: WebSocket.Server;
    private clients: Map<string, WebSocket> = new Map();
    private messageCallbacks: Map<string, (message: any) => void> = new Map();

    private readonly serverPort = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
    private readonly serverUrl = process.env.WS_URL || 'ws://localhost:8080';

    // Client ID will be generated using UUID
    public clientId: string;

    constructor(private readonly settingsService: DatabaseSettingsService) {
        // Generate a client ID using UUID
        this.clientId = uuidv4();
        this.logger.log(`Generated client ID: ${this.clientId}`);
    }

    async onModuleInit() {
        // Initialize WebSocket server
        this.server = new WebSocket.Server({ port: this.serverPort });

        this.server.on('connection', (ws: WebSocket) => {
            this.logger.log('Client connected');

            ws.on('message', (message: string) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());

                    // If this is a registration message, store the client's ID
                    if (parsedMessage.type === 'register') {
                        const clientId = parsedMessage.clientId;
                        this.clients.set(clientId, ws);
                        this.logger.log(`Client registered with ID: ${clientId}`);

                        // Send confirmation
                        ws.send(JSON.stringify({
                            type: 'register_confirm',
                            clientId: this.clientId
                        }));
                    }
                    // Handle regular messages
                    else if (parsedMessage.type === 'message') {
                        // Process the message based on its type
                        this.handleIncomingMessage(parsedMessage.content, parsedMessage.sender);
                    }
                } catch (error) {
                    this.logger.error(`Error processing message: ${error.message}`);
                }
            });

            ws.on('close', () => {
                // Remove client from the map when they disconnect
                for (const [key, client] of this.clients.entries()) {
                    if (client === ws) {
                        this.clients.delete(key);
                        this.logger.log(`Client with ID ${key} disconnected`);
                        break;
                    }
                }
            });
        });

        this.logger.log(`WebSocket server started on port ${this.serverPort}`);
    }

    // Connect to a WebSocket server
    async connectToServer(serverUrl: string): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(serverUrl);

            ws.on('open', () => {
                // Register with the server
                ws.send(JSON.stringify({
                    type: 'register',
                    clientId: this.clientId
                }));

                resolve(ws);
            });

            ws.on('message', (message: string) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());

                    // Handle messages
                    if (parsedMessage.type === 'message') {
                        this.handleIncomingMessage(parsedMessage.content, parsedMessage.sender);
                    }
                } catch (error) {
                    this.logger.error(`Error processing message: ${error.message}`);
                }
            });

            ws.on('error', (error) => {
                this.logger.error(`WebSocket connection error: ${error.message}`);
                reject(error);
            });
        });
    }

    private handleIncomingMessage(message: any, sender: string) {
        // Create a simplified event object
        const event = {
            sender: sender,
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
        if (filter.sender && filter.sender !== event.sender) {
            return false;
        }

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
    async publishDirectMessage(content: string, receiverId: string): Promise<void> {
        // Check if the client is connected to our server
        const client = this.clients.get(receiverId);

        if (client && client.readyState === WebSocket.OPEN) {
            // Send directly to the connected client
            client.send(JSON.stringify({
                type: 'message',
                sender: this.clientId,
                content: content
            }));
        } else {
            // If not connected to our server, try to connect to their server
            // This assumes the receiver has a server running at a known URL
            try {
                const serverUrl = this.serverUrl;
                const ws = await this.connectToServer(serverUrl);

                ws.send(JSON.stringify({
                    type: 'message',
                    sender: this.clientId,
                    receiver: receiverId,
                    content: content
                }));
            } catch (error) {
                this.logger.error(`Failed to send message to ${receiverId}: ${error.message}`);
                throw error;
            }
        }
    }
}
