import { SignableInput } from "@app/blockchain/bitcoin/types/UnspentOutput";
import { Logger } from "@nestjs/common";
import { Psbt } from "bitcoinjs-lib";
import { Runestone } from "runelib";

interface SwapInfo {
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    rate: string;
    networkFee: string;
}

export class FillRuneOrderOffer {
    psbtBase64: string;
    takerInputsToSign: SignableInput[];
    provider: string;
    fee: number;
    id: string;
}

export class SwapTransaction {
    signedBase64Psbt: string;
    offerId: string;
}

export class SwapResult {
    status: 'success' | 'error';
    txid?: string;
    error?: string;
}

export class SwapMessage<T> {
    type: 'prepare' | 'result'
    data: T
}

export class RuneFillRequest {
    takerPaymentAddress: string;
    takerPaymentPublicKey: string;
    takerRuneAddress: string;
    takerRunePublicKey: string;
    side: 'buy' | 'sell';
    amount: bigint;
    rune: string;
}
