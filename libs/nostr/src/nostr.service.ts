
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { PUB_EVENT } from '@app/engine';
import { DM } from '@app/execution';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as secp from "@noble/curves/secp256k1";
import { createCipheriv, createDecipheriv, randomFillSync } from 'crypto';
import { Event, finalizeEvent, getPublicKey, SimplePool } from 'nostr-tools';
import * as WebSocket from 'ws';

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
        if (process.env.NOSTR_KEY) {
            this.privateKey = Uint8Array.from(Buffer.from(process.env.NOSTR_KEY, 'hex'));
            this.publicKey = getPublicKey(this.privateKey);
            return;
          }
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

    async subscribeToOneEvent(filters: any, callback: any) {
        const sub = this.pool.subscribeMany(this.relayUrls, filters, {
            onevent: (event: Event) => {
                if (event.created_at * 1000 >= Date.now() - 5000) {
                    if (event.kind === DM) {
                        event.content = this.decryptEventContent(event);
                    }
                    sub.close();
                    callback(event.content);
                }
            },
            onclose() {
                sub.close();
            }
        })
    }

    async subscribeToEvent(filters: any, callback: any): Promise<void> {
        const connect = () =>
            this.pool.subscribeMany(this.relayUrls, filters, {
                onevent: (event: Event) => {
                    if (event.created_at * 1000 >= Date.now() - 5000) {
                        if (event.kind === DM) {
                            event.content = this.decryptEventContent(event);
                        }
                        callback(event.content);
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
            content: this.encryptContent(content, receiverPublicKey),
        };

        await Promise.all(this.pool.publish(this.relayUrls, finalizeEvent(event, this.privateKey)));

    }

    encryptContent(message: string, makerPubkey: string) {

        // Derive shared secret
        const sharedPoint = secp.secp256k1.getSharedSecret(this.privateKey, '02' + makerPubkey);
        const sharedX = sharedPoint.slice(1, 33); // Extract x-coordinate

        // Generate random IV
        const iv = randomFillSync(new Uint8Array(16));

        // Encrypt the message
        const cipher = createCipheriv('aes-256-cbc', Buffer.from(sharedX), iv);
        let encryptedMessage = cipher.update(message, 'utf8', 'base64');
        encryptedMessage += cipher.final('base64');
        // Encode IV
        const ivBase64 = Buffer.from(iv).toString('base64');
        return `${encryptedMessage}?iv=${ivBase64}`;
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
