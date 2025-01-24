import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as dotenv from 'dotenv';
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
 
dotenv.config();

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

@Injectable()
export class BitcoinWalletService implements OnModuleInit {
    private readonly privateKey: string;
    private readonly network: bitcoin.Network;
    private signer: bitcoin.Signer;

    constructor() {
        this.privateKey = process.env.BITCOIN_PRIVATE_KEY || '';
        if (!this.privateKey) {
            throw new Error('Bitcoin private key not set in environment variables.');
        }

        const networkType = process.env.BITCOIN_NETWORK || 'mainnet';
        this.network = networkType === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    }

    onModuleInit() {
        try {
            this.signer = this.importWalletFromPrivateKey(this.privateKey);
            console.log('Bitcoin wallet initialized:', this.generateP2TRAddress().address);
        } catch (error) {
            console.error('Failed to initialize Bitcoin wallet:', error.message);
        }
    }

    importWalletFromPrivateKey(privateKey: string): bitcoin.Signer {
        try {
            // Decode the private key (WIF format expected)
            const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network: this.network });
            return keyPair;
        } catch (error) {
            throw new Error(`Invalid private key: ${error.message}`);
        }
    }

    generateP2TRAddress(): { address: string; type: string } {
        try {
            const keyPair = this.signer;
            const { address } = bitcoin.payments.p2tr({ pubkey: toXOnly(keyPair.publicKey), network: this.network });
            if (!address) {
                throw new Error('Failed to generate P2TR address.');
            }
            return { address, type: 'P2TR' };
        } catch (error) {
            throw new Error(`Error generating P2TR address: ${error.message}`);
        }
    }
}