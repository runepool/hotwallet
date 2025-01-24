import { SignableInput } from "@app/blockchain/bitcoin/types/UnspentOutput";
import { Logger } from "@nestjs/common";
import { Psbt } from "bitcoinjs-lib";
import { Runestone } from "runelib";

export class FillRuneOrderOffer {
    psbtBase64: string;
    takerInputsToSign: SignableInput[]
    static fromBase64Psbt(psbtString: string): RuneFillRequest {
        try {
            const psbt = Psbt.fromBase64(psbtString);
            const runestone = Runestone.decipher(psbt.data.globalMap.unsignedTx.toBuffer().toString('hex')).value();
            if (runestone.pointer.isSome()) {
                throw "Invalid runestone pointer";
            }
            return Object.assign(new RuneFillRequest(), {
                buyerAddress: psbt.txOutputs[runestone.edicts[0].output],
                runeAmount: runestone.edicts[0].amount,
                sellerAddress: psbt.txOutputs[runestone.edicts[0].output + 1].address,
                sats: psbt.txOutputs[runestone.edicts[0].output + 1].value,
            })
        } catch (error) {
            console.log(error);
            Logger.log(`Could not decode fill request`)
        }

    }
}

export class RuneFillRequest {
    takerAddress: string;
    takePublicKey: string;
    side: 'buy' | 'sell';
    runeAmount: bigint;
    rune: string;
}
