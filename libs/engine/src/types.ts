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
}

export class RuneFillRequest {
    takerAddress: string;
    takePublicKey: string;
    side: 'buy' | 'sell';
    amount: bigint;
    rune: string;
}
