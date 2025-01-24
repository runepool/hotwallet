import { Psbt, Transaction } from "bitcoinjs-lib";
import { SignableInput, UnspentOutput } from "./bitcoin/types/UnspentOutput";
import { PsbtInput } from "bip174/src/lib/interfaces";
import { calculateTransactionSize } from "./bitcoin/utils";


export const sumInputsValues = (psbt: Psbt) => (prev: number, curr: PsbtInput, index: number) => {
    if (curr.witnessUtxo) {
        return prev + curr.witnessUtxo.value
    }
    const tx = Transaction.fromBuffer(curr.nonWitnessUtxo);
    return prev + tx.outs[psbt.txInputs[index].index].value
}


/**
 * Can be used to append inputs that can cover for the network fee.
 *
 * @param psbt The psbt that will unlock the collateral and liquidate/repay the loan
 * @param unspentOutputs Used to pay for the fee
 * @param signatureCount An array that keeps track on how many signatures are required for any given input see {@linkcode addResidualValue}
 * @param changeAddress Address that will receive the change
 * @param feeRate The current fee rate required by network
 * @param parentFee the parent fee in case the tx is a cpfp
 */
export const appendUnspentOutputsAsNetworkFee = (
    psbt: Psbt,
    unspentOutputs: UnspentOutput[],
    signatureCount: number[],
    changeAddress: string,
    feeRate: number,
    inputsToSign: SignableInput[],
    parentFee: number = 0
) => {
    let totalIn = psbt.data.inputs.reduce(sumInputsValues(psbt), 0);
    let totalOut = psbt.txOutputs.reduce((prev, curr) => prev + curr.value, 0);

    let _feeTx = psbt.clone().addOutput({
        address: changeAddress,
        value: 1000,
    });

    // Cover the transaction fee
    let txSize = calculateTransactionSize(_feeTx.data.inputs, _feeTx.txOutputs, signatureCount);
    let fee = Math.ceil(txSize * feeRate) + parentFee;

    let input: UnspentOutput;
    if (totalIn < totalOut + fee) {
        while ((input = unspentOutputs.pop())) {

            psbt.addInput(input.toInput());

            inputsToSign.push({
                index: psbt.inputCount - 1,
                signerAddress: input.signerAddress,
                singerPublicKey: input.publicKey,
                hasRunes: input.hasRunes,
                hasInscriptions: input.hasInscriptions,
                location: input.location
            })

            totalIn += input.amount;
            signatureCount.push(1);

            _feeTx = psbt.clone().addOutput({
                address: changeAddress,
                value: 1000,
            });

            txSize = calculateTransactionSize(_feeTx.data.inputs, _feeTx.txOutputs, signatureCount);
            fee = Math.ceil(txSize * feeRate) + parentFee;

            if (totalIn >= totalOut + fee) {
                break;
            }
        }
    }

    const change = totalIn - totalOut - fee;
    if (change < 0) {
        throw "Insufficient funds";
    }

    let changeOutputIndex: number | undefined;
    if (change > 546) {
        psbt.addOutput({
            address: changeAddress,
            value: change,
        });
        changeOutputIndex = psbt.txOutputs.length - 1;
    } else {
        fee += change;
    }

    return { fee, changeOutputIndex };
};