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
 * @param inputsToSign An array of inputs that need to be signed
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

/**
 * Deducts the network fee from a specific output in the PSBT
 * @param psbt The PSBT to modify
 * @param outputIndex Index of the output to deduct fees from
 * @param feeRate The current fee rate required by network
 * @returns The calculated network fee
 * @throws Error if output value would be below dust limit after fee deduction
 */
export const takeNetowrkFeeFromOutput = (
    psbt: Psbt,
    outputIndex: number,
    feeRate: number,
    changeAddress: string,
    fundingOutputs: UnspentOutput[],
    inputsToSign: SignableInput[],
): { psbt: Psbt, fee: number } => {
    let totalIn = psbt.data.inputs.reduce(sumInputsValues(psbt), 0);
    let totalOut = psbt.txOutputs.reduce((prev, curr) => prev + curr.value, 0);

    let mockTx = new Psbt();
    psbt.txOutputs.forEach((output, index) => {
        if (index === outputIndex) {
            return;
        }
        mockTx.addOutput({
            address: output.address,
            value: output.value,
            script: output.script
        });
    });

    psbt.txInputs.forEach((input, index) => {
        if (index === outputIndex) {
            return;
        }
        mockTx.addInput(input);
    });

    // The tx fee will be deducted out of the loan amount
    let initialAmount = psbt.txOutputs[outputIndex].value;
    let receiver = psbt.txOutputs[outputIndex].address;

    // Calculate the initial transaction fee
    let txSize = calculateTransactionSize(psbt.data.inputs, psbt.txOutputs);
    let fee = Math.ceil(txSize * feeRate);

    let input: UnspentOutput;
    let netAmount = initialAmount;
    if (totalIn < totalOut) {
        while ((input = fundingOutputs.shift())) {
            psbt.addInput(input.toInput());
            inputsToSign.push({ signerAddress: input.signerAddress, index: psbt.inputCount - 1, singerPublicKey: input.publicKey, location: input.location });

            let _feeTx = mockTx
                .clone()
                .addOutput({
                    address: receiver,
                    value: netAmount,
                })
                .addOutput({
                    address: changeAddress,
                    value: 1000,
                });

            txSize = calculateTransactionSize(_feeTx.data.inputs, _feeTx.txOutputs);
            fee = Math.ceil(txSize * feeRate);
            netAmount = initialAmount - fee;

            totalOut -= fee;
            totalIn += input.amount;

            if (totalIn >= totalOut) break;
        }
    }

    const change = totalIn - totalOut - fee;

    if (netAmount < 546) {
        throw "Dust";
    }

    if (change < 0) {
        throw "Insufficient funds";
    }

    const newTx = new Psbt();
    psbt.txInputs.forEach((_, index) => newTx.addInput({
        ...psbt.data.globalMap.unsignedTx['tx'].ins[index],
        ...psbt.data.inputs[index],
    }));

    psbt.txOutputs.forEach((_, index) => {
        if (index === outputIndex) {
            newTx.addOutput({
                address: psbt.txOutputs[index].address,
                value: netAmount
            });
            return;
        } 
        newTx.addOutput({
            address: psbt.txOutputs[index].address,
            value: psbt.txOutputs[index].value,
            script: psbt.txOutputs[index].script,
        });
    });

    if (change >= 546) {
        newTx.addOutput({
            address: changeAddress,
            value: change,
        });
    } else {
        fee += change;
    }

    return { psbt: newTx, fee };

};