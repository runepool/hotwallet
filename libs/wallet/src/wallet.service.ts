import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory, { ECPairInterface } from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as dotenv from 'dotenv';
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import { tweakSigner } from '@app/blockchain/bitcoin/utils';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { EncryptionService } from './encryption.service';
import { combine, split } from 'shamir-secret-sharing';
import { randomBytes } from 'crypto';
import { UInt8 } from 'bitcoinjs-lib/src/types';

dotenv.config();

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

@Injectable()
export class BitcoinWalletService {
    public readonly network: bitcoin.Network;
    private _keyShards: string[] = [];
    private _address: string;
    private _publicKey: string;
    private _shardKeys: Buffer[] = [];


    constructor(
        private readonly settingsService: DatabaseSettingsService,
        private readonly encryptionService: EncryptionService
    ) {
        const networkType = process.env.BITCOIN_NETWORK || 'mainnet';
        this.network = networkType === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    }

    reset() {
        this._keyShards = [];
        this._shardKeys?.forEach(key => key.fill(0));
        this._shardKeys = [];
        this._address = undefined;
        this._publicKey = undefined;
    }

    async init(password?: string) {
        try {
            const settings = await this.settingsService.getSettings();
            const encryptedKey = settings.bitcoinPrivateKey;

            if (!encryptedKey) {
                throw new Error('Bitcoin private key not set in settings.');
            }

            // Always require a password to decrypt the key
            if (!password) {
                throw new Error('Password required to decrypt Bitcoin private key');
            }
            let key;
            try {
                key = await this.encryptionService.decrypt(encryptedKey, password);
                const shards = await split(Uint8Array.from(Buffer.from(key, 'hex')), 16, 16);

                for (const shard of shards) {
                    const shardKey = randomBytes(32);
                    const encryptedShard = await this.encryptionService.encrypt(shard.toString(), shardKey.toString('hex'));
                    this._shardKeys.push(shardKey);
                    this._keyShards.push(encryptedShard);
                }

            } catch (error) {
                throw new Error(`Invalid password or corrupted key data ${error.message}`);
            }

            const signer = this.importWalletFromPrivateKey(Buffer.from(key, 'hex'));
            this._publicKey = signer.publicKey.toString("hex");
            this._address = this.generateP2TRAddress(signer.publicKey).address;
            console.log('Bitcoin wallet initialized:', this._address);
        } catch (error) {
            console.error('Failed to initialize Bitcoin wallet:', error.message);
            throw error; // Re-throw to allow handling by caller
        }
    }

    async withSigner(fn: (signer: ECPairInterface) => any) {
        if (!this._shardKeys.length || !this._keyShards.length) {
            throw new Error('Bitcoin wallet not initialized');
        }

        const decryptedShards = await Promise.all(this._shardKeys.map(async shardKey => {
            return Buffer.from(await this.encryptionService.decrypt(this._keyShards[this._shardKeys.indexOf(shardKey)], shardKey.toString('hex')), 'hex');
        }));

        const keyBuffer = await combine(decryptedShards).then(data => Buffer.from(data));
        const signer = this.importWalletFromPrivateKey(keyBuffer);
        const result = fn(signer);
        keyBuffer.fill(0);
        decryptedShards.forEach(shard => shard.fill(0));
        signer.privateKey?.fill(0);
        return result;
    }



    async signPsbt(psbt: bitcoin.Psbt, inputs: number[]): Promise<bitcoin.Psbt> {
        return this.withSigner(signer => {
            if (inputs.length === 0) return psbt.signAllInputs(tweakSigner(signer));

            inputs.forEach(input => {
                psbt.signInput(input, tweakSigner(signer));
            })

            return psbt;
        });
    }

    importWalletFromPrivateKey(privateKey: Buffer): ECPairInterface {
        try {
            // Decode the private key (WIF format expected)
            const keyPair = ECPair.fromPrivateKey(privateKey, { network: this.network });
            return keyPair;
        } catch (error) {
            throw new Error(`Invalid private key: ${error.message}`);
        }
    }

    private generateP2TRAddress(publicKey: Buffer): { address: string; type: string } {
        try {
            const { address } = bitcoin.payments.p2tr({ internalPubkey: toXOnly(publicKey), network: this.network });
            if (!address) {
                throw new Error('Failed to generate P2TR address.');
            }
            return { address, type: 'P2TR' };
        } catch (error) {
            throw new Error(`Error generating P2TR address: ${error.message}`);
        }
    }

    public async getAddress(): Promise<string> {
        if (!this._address) {
            throw new Error('Bitcoin wallet not initialized');
        }
        return this._address;
    }

    public async getPublicKey(): Promise<string> {
        if (!this._publicKey) {
            throw new Error('Bitcoin wallet not initialized');
        }
        return this._publicKey;
    }

    /**
     * Encrypts a private key with a password
     * @param privateKey The private key to encrypt
     * @param password The password to use for encryption
     * @returns The encrypted private key
     */
    async encryptPrivateKey(privateKey: string, password: string): Promise<string> {
        return this.encryptionService.encrypt(privateKey, password);
    }

    /**
     * Checks if a wallet is initialized with a valid signer
     */
    isInitialized(): boolean {
        return !!this._publicKey && !!this._address;
    }
}