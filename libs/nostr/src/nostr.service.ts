import { RuneOrder } from '@app/database/entities/rune-order';
import { Injectable } from '@nestjs/common';
import { Event, finalizeEvent, getPublicKey, SimplePool } from 'nostr-tools';

import * as WebSocket from 'ws';


@Injectable()
export class NostrService {
    private readonly relayUrls = [
        "wss://relayable.org",
        "wss://relay.damus.io",
        "wss://norst.wine"
    ];
    private privateKey: Uint8Array;
    private publicKey: string;
    private pool: SimplePool

    constructor() {
        this.privateKey = Uint8Array.from(Buffer.from(process.env["NOSTR_KEY"], 'hex'));
        this.publicKey = getPublicKey(this.privateKey);
        this.pool = new SimplePool();
        this.pool["_WebSocket"] = WebSocket;

        console.log('Nostr public key:', this.publicKey);
    }

    async publishOrder(content: RuneOrder): Promise<void> {

        const event = {
            kind: 30078, // Kind 30078: p2p order
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

    async subscribeToEvents(kind: number, callback: any): Promise<void> {
        const h = this.pool.subscribeMany(this.relayUrls, [
            { kinds: [kind] }
        ], {
            onevent: (event: Event) => {
                callback(event);
            },
            oneose() {
                h.close()
            }
        })
    }

    async publishDirectMessage(content: string, receiverPublicKey: string): Promise<void> {
        const event = {
            kind: 4, // Kind 4: Encrypted Direct Message
            pubkey: this.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', receiverPublicKey]],
            content,
        };
        this.pool.publish(this.relayUrls, finalizeEvent(event, this.privateKey));
        console.log('Published admin message:', event);
    }
}
