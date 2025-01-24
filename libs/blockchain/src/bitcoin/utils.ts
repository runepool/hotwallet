import { PsbtInput, PsbtInputExtended, PsbtOutputExtended } from "bip174/src/lib/interfaces";
import { Network, Psbt, initEccLib } from "bitcoinjs-lib";
import { fromOutputScript } from "bitcoinjs-lib/src/address";
import { taggedHash } from "bitcoinjs-lib/src/crypto";
import { witnessStackToScriptWitness } from "bitcoinjs-lib/src/psbt/psbtutils";

import ECPairFactory, { ECPairInterface } from "ecpair";
import * as ecc from "tiny-secp256k1";

import { p2sh } from "bitcoinjs-lib/src/payments";
initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
export const FEE_RATIO_ADJUST = 1;

export const toXOnly = (pubKey: Buffer): Buffer => (pubKey.length === 32 ? pubKey : pubKey.slice(1, 33));

export const tweakSigner = (signer: ECPairInterface, opts: any = {}): ECPairInterface => {
  let privateKey: Uint8Array | undefined = signer.privateKey!;
  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }
  if (signer.publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey);
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(toXOnly(signer.publicKey), opts.tweakHash),
  );
  if (!tweakedPrivateKey) {
    throw new Error('Invalid tweaked private key!');
  }

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  });
}

export const tapTweakHash = (pubKey: Buffer, h: Buffer | undefined): Buffer => {
  return taggedHash("TapTweak", Buffer.concat(h ? [pubKey, h] : [pubKey]));
};

/**
 *  Return the transaction size based on inputs and outputs as per bitcoin specifications
 *  https://en.bitcoin.it/wiki/Transaction#Explanation
 */
export const calculateTransactionSize = (inputs: PsbtInputExtended[], outputs: PsbtOutputExtended[], signatures?: number[]) => {
  // If the signature flags are not set we initialize them with 1 signature per input
  if (!signatures) {
    signatures = [];
  }

  // Version + Market + Flag + #inputs (max 252) + #outputs (max 252) + locktime
  const STANDARD_SEGWIT_BYTES = 4 * 4 + 1 + 1 + 4 * 1 + 4 * 1 + 4 * 4;
  const INPUTS_COST = 41 * inputs.length;
  const OUTPUT_COST = 9 * outputs.length;

  if (inputs.length > 252) {
    throw "To many inputs"
  }

  if (outputs.length > 252) {
    throw "To many outputs";
  }

  let totalWitnessDataSize = 0;
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    const signature = signatures[i] || 1;
    if (input.tapLeafScript) {
      totalWitnessDataSize +=
        1 + signature * 64 + input.tapLeafScript[0].script.byteLength + input.tapLeafScript[0].controlBlock.byteLength;
    } else if (input.witnessScript) {
      totalWitnessDataSize += 1 + 32 + signature * (1 + 72) + 1 + input.witnessScript.byteLength;
    } else {
      totalWitnessDataSize += signature * 140;
    }
  }

  let outputScriptsSize = 0;
  for (const out of outputs) {
    outputScriptsSize += (out.script as Buffer).byteLength;
  }

  const TOTAL_SIZE = 4 * (OUTPUT_COST + outputScriptsSize) + STANDARD_SEGWIT_BYTES + INPUTS_COST * 4 + totalWitnessDataSize;
  return Math.ceil(TOTAL_SIZE / 4) + 1;
};

export const estimatePsbtFee = (psbt: Psbt, feeRate: number, signaturesPerInput?: number[]) => {
  const size = calculateTransactionSize(psbt.data.inputs, psbt.txOutputs, signaturesPerInput);
  return Math.ceil(feeRate * size);
};

export enum AddressType {
  TAPROOT = 'taproot',
  SEGWIT = 'segwit',
  NORMAL = 'normal',
  UNKNOWN = 'unknown'
}

export const getAddressType = (address: string): AddressType => {
  const typePrefix = address?.slice(1, 4) || 'unknown';
  if (typePrefix === 'unknown') {
    return AddressType.UNKNOWN;
  }

  if (!isNaN(Number(address[0]))) {
    return AddressType.NORMAL;
  }

  if (typePrefix.endsWith('1p') || typePrefix.endsWith('rt')) {
    return AddressType.TAPROOT;
  }

  if (typePrefix.endsWith('1q')) {
    return AddressType.SEGWIT;
  }

  return AddressType.UNKNOWN;
}

export const decodeScriptToAddress = (script: Buffer, network: Network) => {
  try {
    // Try go get the P2SH wrapped address
    return fromOutputScript(script, network);
  } catch (error) { }

  // Try p2sh wrapped
  const address = p2sh({
    redeem: {
      output: script.slice(1),
    },
  }).address;

  return address;
}

export const isTaprootScriptPubKey = (scriptPubKey: string) => {
  return scriptPubKey.slice(0, 2) === '51' && scriptPubKey.slice(2, 4) === '20' && scriptPubKey.slice(4).length === 64;
};
