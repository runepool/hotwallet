import { SignableInput, UnspentOutput } from "@app/blockchain/bitcoin/types/UnspentOutput";
import { RuneOrder } from "@app/exchange-database/entities/rune-order.entity";


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
    fee: number;
    id: string;
}

export class SwapTransaction {
    signedBase64Psbt: string;
    tradeId: string;
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

export interface SelectedOrder {
    order: RuneOrder;
    usedAmount: bigint;
    satAmount: bigint;
    outputs: UnspentOutput[];
}
