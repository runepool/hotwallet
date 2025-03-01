import { SignableInput } from "@app/blockchain/bitcoin/types/UnspentOutput";

export interface SwapInfo {
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

export class Message<T> {
    type: 'reserve_request' | 'reserve_response' | 'sign_request' | 'sign_response' | 'result'
    data: T
}

export class ReserveOrdersResponse {
    status: 'success' | 'error';
    tradeId: string;
    reservedUtxos: string[];
    error?: string;
}

export class ReserveOrdersRequest {
    tradeId: string;
    orders: OrderFill[]
}

export interface OrderFill {
    orderId: string;
    amount: string;
}

export class SignRequest {
    tradeId: string;
    psbtBase64: string;
    inputsToSign: SignableInput[];
}

export class SignResponse {
    status: 'success' | 'error';
    tradeId: string;
    signedPsbtBase64: string;
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
