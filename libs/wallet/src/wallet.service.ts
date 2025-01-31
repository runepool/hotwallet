import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory, { ECPairInterface } from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as dotenv from 'dotenv';
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import { tweakSigner } from '@app/blockchain/bitcoin/utils';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';

dotenv.config();

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

@Injectable()
export class BitcoinWalletService {
    public readonly network: bitcoin.Network;
    private _privateKey: string;
    private _signer: ECPairInterface;
    private _address: string;
    private _publicKey: string;


    constructor(private readonly settingsService: DatabaseSettingsService) {
        const networkType = process.env.BITCOIN_NETWORK || 'mainnet';
        this.network = networkType === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    }

    reset() {
        this._privateKey = undefined;
        this._signer = undefined;
        this._address = undefined;
        this._publicKey = undefined;
    }

    async init() {
        try {
            const settings = await this.settingsService.getSettings();
            this._privateKey = settings.bitcoinPrivateKey;

            if (!this._privateKey) {
                throw new Error('Bitcoin private key not set in settings.');
            }

            this._signer = this.importWalletFromPrivateKey(this._privateKey);
            this._publicKey = toXOnly(this._signer.publicKey).toString("hex");
            this._address = this.generateP2TRAddress().address;
            console.log('Bitcoin wallet initialized:', this.generateP2TRAddress().address);
        } catch (error) {
            console.error('Failed to initialize Bitcoin wallet:', error.message);
        }
    }

    signPsbt(psbt: bitcoin.Psbt, inputs: number[]) {
        if(inputs.length === 0) return psbt.signAllInputs(tweakSigner(this._signer));

        inputs.forEach(input => {
            psbt.signInput(input, tweakSigner(this._signer));
        })

        return psbt;
    }

    importWalletFromPrivateKey(privateKey: string): ECPairInterface {
        try {
            // Decode the private key (WIF format expected)
            const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network: this.network });
            return keyPair;
        } catch (error) {
            throw new Error(`Invalid private key: ${error.message}`);
        }
    }

    private generateP2TRAddress(): { address: string; type: string } {
        try {
            const keyPair = this._signer;
            const { address } = bitcoin.payments.p2tr({ internalPubkey: toXOnly(keyPair.publicKey), network: this.network });
            if (!address) {
                throw new Error('Failed to generate P2TR address.');
            }
            return { address, type: 'P2TR' };
        } catch (error) {
            throw new Error(`Error generating P2TR address: ${error.message}`);
        }
    }

    public async getAddress(): Promise<string> {
        if (!this._signer) {
            await this.init();
        }
        return this._address;
    }

    public async getPublicKey(): Promise<string> {
        if (!this._signer) {
            await this.init();
        }
        return this._publicKey;
    }

}