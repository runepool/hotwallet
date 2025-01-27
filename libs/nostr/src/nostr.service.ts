import { RuneOrder } from '@app/database/entities/rune-order';
import { PUB_EVENT } from '@app/engine';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Event, finalizeEvent, getPublicKey, SimplePool } from 'nostr-tools';
import * as WebSocket from 'ws';
import { createDecipheriv } from 'crypto';
import { pointMultiply } from '@bitcoinerlab/secp256k1';
import * as secp from "@noble/curves/secp256k1";
import { DatabaseSettingsService } from '@app/database/settings/settings.service';

@Injectable()
export class NostrService implements OnModuleInit {
    private readonly relayUrls = [
        'wss://relay.runepool.org',
    ];
    private privateKey: Uint8Array;
    public publicKey: string;
    private pool: SimplePool;

    constructor(private readonly settingsService: DatabaseSettingsService) {
        this.pool = new SimplePool();
        this.pool["_WebSocket"] = WebSocket;
    }

    async onModuleInit() {
        await this.updateKeys();
    }

    async updateKeys() {
        const settings = await this.settingsService.getSettings();
        if (!settings.nostrPrivateKey) {
            return;
        }
        this.privateKey = Uint8Array.from(Buffer.from(settings.nostrPrivateKey, 'hex'));
        this.publicKey = getPublicKey(this.privateKey);
        console.log('Nostr public key:', this.publicKey);
    }

    async publishOrder(content: RuneOrder): Promise<void> {

        const event = {
            kind: PUB_EVENT, // Kind 30078: p2p order
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["s", content.type],
                ["amt", content.quantity.toString()],
                ["price", content.price.toString()],
                ["rune", content.rune],
                ["d", "liquidium-dex"],
                ["network", "mainnet"],
            ],
            content: ""
        };

        const ev = finalizeEvent(event, this.privateKey);
        const result = await Promise.all(this.pool.publish(this.relayUrls, ev));
        console.log('Published event:', event, result);
    }

    async subscribeToEvent(filters: any, callback: any): Promise<void> {
        const connect = () =>
            this.pool.subscribeMany(this.relayUrls, filters, {
                onevent: (event: Event) => {
                    if (event.created_at * 1000 >= Date.now() - 5000) {
                        callback(event);
                    }
                },
                onclose() {
                    connect();
                }
            })
        connect()
    }

    async publishDirectMessage(content: string, receiverPublicKey: string): Promise<void> {
        const event = {
            kind: 4, // Kind 4: Encrypted Direct Message
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', receiverPublicKey]],
            content,
        };

        await Promise.all(this.pool.publish(this.relayUrls, finalizeEvent(event, this.privateKey)));

    }

    decryptEventContent(event: Event) {
        try {
            // Parse the encrypted content to extract the message and IV
            const [encryptedMessage, ivBase64] = event.content.split('?iv=');
            const iv = Buffer.from(ivBase64, 'base64'); // Decode IV from Base64

            // Derive the shared secret
            
            const sharedPoint = secp.secp256k1.getSharedSecret(this.privateKey, Uint8Array.from(Buffer.from('02' + event.pubkey, 'hex')));
            const sharedX = sharedPoint.slice(1, 33); // Extract x-coordinate

            // Decrypt the message
            const decipher = createDecipheriv('aes-256-cbc', Buffer.from(sharedX), iv);
            let decryptedMessage = decipher.update(encryptedMessage, 'base64', 'utf8');
            decryptedMessage += decipher.final('utf8');

            return decryptedMessage;
        } catch (error) {
            console.error('Decryption failed:', error.message);
            throw new Error('Failed to decrypt the message');
        }
    }
}
