import { TapLeafScript, WitnessUtxo } from "bip174/src/lib/interfaces";
import { Psbt, Transaction } from "bitcoinjs-lib";
import { Network } from "bitcoinjs-lib/src/networks";

import { p2sh, p2wpkh } from "bitcoinjs-lib/src/payments";
import { AddressType, decodeScriptToAddress, getAddressType, isTaprootScriptPubKey, toXOnly } from "../utils";

export interface InputConfiguration {
    tapLeafScript?: TapLeafScript[];
    sighashType?: number;
    sequence?: number | undefined;
}

export class UnspentOutput {
    txid: string;
    vout: number;
    scriptPubKey: string;
    amount: number;
    safe?: boolean;
    tx: string;
    address: string;
    signerAddress: string;
    publicKey?: string;
    network: Network;
    runeIds?: string[];
    runeBalances?: bigint[];
    inscriptions?: string[];

    get location() {
        return `${this.txid}:${this.vout}`;
    }

    get hasInscriptions() {
        return this.inscriptions && this.inscriptions.length > 0;
    }

    get hasRunes() {
        return this.runeIds && this.runeIds.length > 0;
    }

    get witnessUtxo(): WitnessUtxo {
        const script = Buffer.from(this.scriptPubKey, 'hex');
        const addressType = getAddressType(this.address)
        if (addressType === AddressType.SEGWIT || addressType === AddressType.TAPROOT) {
            return {
                script: script,
                value: this.amount
            }
        }
    }

    get nonWitnessUtxo(): Buffer {
        const addressType = getAddressType(this.address)
        if (addressType === AddressType.NORMAL) {
            return Transaction.fromHex(this.tx).toBuffer();
        }
    }

    public toInput(configuration?: InputConfiguration): Parameters<Psbt["addInput"]>[0] {
        let input: Parameters<Psbt["addInput"]>[0];
        if (configuration?.tapLeafScript) {
            input = {
                hash: this.txid,
                index: this.vout,
                sequence: configuration?.sequence,
                witnessUtxo: this.witnessUtxo,
                tapLeafScript: configuration?.tapLeafScript
            }
        }

        if (!input && this.nonWitnessUtxo) {
            const _p2wpkh = p2wpkh({
                pubkey: Buffer.from(this.publicKey, 'hex'),
                network: this.network
            });

            const _p2sh = p2sh({
                redeem: _p2wpkh,
                network: this.network
            });

            input = {
                hash: this.txid,
                index: this.vout,
                sequence: configuration?.sequence,
                nonWitnessUtxo: this.nonWitnessUtxo,
                redeemScript: _p2sh.redeem.output
            }
        }

        if (!input && isTaprootScriptPubKey(this.scriptPubKey)) {
            input = {
                hash: this.txid,
                index: this.vout,
                sequence: configuration?.sequence,
                witnessUtxo: this.witnessUtxo,
                tapInternalKey: toXOnly(Buffer.from(this.publicKey, 'hex'))
            }
        }

        if (!input && this.witnessUtxo) {
            input = {
                hash: this.txid,
                index: this.vout,
                sequence: configuration?.sequence,
                witnessUtxo: this.witnessUtxo
            }
        }

        if (!input) {
            throw "UnprocessableInputError";
        }

        if (configuration?.sighashType) {
            input.sighashType = configuration.sighashType;
        }

        return input;
    }

    static extractUnspentOutputFromTx(tx: Transaction, outputIndex: number, network: Network, signerAddress?: string, publicKey?: string) {
        const address = decodeScriptToAddress(tx.outs[outputIndex].script, network)
        return Object.assign(new UnspentOutput(), {
            tx: tx.toHex(),
            txid: tx.getId(),
            vout: outputIndex,
            address,
            amount: tx.outs[outputIndex].value,
            scriptPubKey: tx.outs[outputIndex].script.toString('hex'),
            signerAddress: signerAddress || address,
            publicKey,
            safe: true,
            network
        } as UnspentOutput)
    }
}


export class BitcoinRawTransaction {
    hex: string;
    txid: string;
    hash: string;
    size: number;
    vsize: number;
    version: number;
    confirmations: number;
    locktime: number;
    vin: Array<{
        txid: string;
        vout: number;
        scriptSig: {
            asm: string;
            hex: string;
        };
        sequence: number;
        txinwitness?: string[];
    }>;
    vout: Array<{
        value: number;
        n: number;
        scriptPubKey: {
            asm: string;
            hex: string;
            reqSigs?: number;
            type: string;
            address?: string;
        };
    }>;
}

export class SignableInput {
    index: number;
    sigHash?: number;
    isCustom?: boolean;
    signerAddress: string;
    singerPublicKey: string;
    hasRunes?: boolean;
    hasInscriptions?: boolean;
    location: string;
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type MsigSignableInput = PartialBy<SignableInput, 'singerPublicKey'>;
