import { BlockchainService } from '@app/blockchain';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { SignableInput, UnspentOutput } from '@app/blockchain/bitcoin/types/UnspentOutput';
import { appendUnspentOutputsAsNetworkFee, takeNetowrkFeeFromOutput } from '@app/blockchain/psbtUtils';
import { RunesService } from '@app/blockchain/runes/runes.service';

import { OrderStatus, RuneOrder, RuneOrderType } from '@app/database/entities/rune-order';

import { Transaction as Trade, TransactionStatus, TransactionType } from '@app/database/entities/transactions';
import { RuneOrdersService } from '@app/database/rune-orders/rune-orders.service';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';
import { NostrService } from '@app/nostr';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { Errors, OracleError } from 'libs/errors/errors';
import { Event } from 'nostr-tools';
import { Edict, none, RuneId, Runestone } from 'runelib';
import { FillRuneOrderOffer, RuneFillRequest, SwapMessage, SwapResult, SwapTransaction } from './types';
import Decimal from 'decimal.js';
import { AutoSplitConfigService } from '@app/database/auto-split/auto-split.service';
import { RuneInfo } from '@app/blockchain/runes/types';

export const PUB_EVENT = 69420;
export const SUB_EVENT = 69421;
export const DM = 4;
export const MAKER_BONUS = 100;
export const PROTOCOL_FEE = 100;
export const PROTOCOL_FEE_OUTPUT = 'bc1pughzj2s7d2979z3vaf0reaszrx5pye9k8glwvvha7yh0nt64kgzsx83r0c';

interface PreparePsbtResult {
    swapPsbt: Psbt;
    buyerInputsToSign: SignableInput[];
    sellerInputsToSign: SignableInput[];
    fee: number;
}

@Injectable()
export class RuneEngineService implements OnModuleInit {
    constructor(
        private readonly orderService: RuneOrdersService,
        private readonly bitcoinService: BitcoinService,
        private readonly walletService: BitcoinWalletService,
        private readonly runeService: RunesService,
        private readonly transactionsDbService: TransactionsDbService,
        private readonly blockchainService: BlockchainService,
        private readonly nostrService: NostrService,
        private readonly autoSplitConfigService: AutoSplitConfigService
    ) { }

    onModuleInit() {
        this.nostrService.subscribeToEvent([
            { kinds: [SUB_EVENT], }
        ], async (event: Event) => {
            try {
                const fillOrderRequest = Object.assign(new RuneFillRequest(), JSON.parse(Buffer.from(event.content, 'base64').toString('utf-8')));
                const result = await this.process(fillOrderRequest);
                await this.nostrService.publishDirectMessage(JSON.stringify(
                    {
                        type: 'prepare',
                        data: result
                    } as SwapMessage<FillRuneOrderOffer>
                ), event.pubkey);
            } catch (error) {
                console.log("Error", error);
                // Logger.error("Could not decode nostr event")
            }
        })

        this.nostrService.subscribeToEvent([
            {
                kinds: [DM],
                '#p': [this.nostrService.publicKey],
            }
        ], async (event: Event) => {
            try {
                const swapData = this.nostrService.decryptEventContent(event);
                const result = await this.finalize(JSON.parse(swapData));

                Logger.log("Finalized swap:", result);
                await this.nostrService.publishDirectMessage(JSON.stringify({
                    type: 'result',
                    data: result
                } as SwapMessage<SwapResult>
                ), event.pubkey);

            } catch (error) {
                console.log("Error", error);

                const result = {
                    status: 'error',
                    error: 'Could not finalize swap'
                } as SwapResult

                await this.nostrService.publishDirectMessage(JSON.stringify({
                    type: 'result',
                    data: result
                } as SwapMessage<SwapResult>), event.pubkey);
            }
        })
    }

    async finalize(swap: SwapTransaction): Promise<SwapResult> {
        const psbt = Psbt.fromBase64(swap.signedBase64Psbt);
        const tx = psbt.extractTransaction();
        const transaction = await this.transactionsDbService.findById(swap.offerId);

        if (!transaction) {
            throw "Transaction not found";
        }

        const txid = await this.bitcoinService.broadcast(tx.toHex());

        transaction.status = TransactionStatus.CONFIRMING;
        transaction.txid = txid;

        try {
            const orders = transaction.orders.split(",").map(async item => {
                const [id, amount] = item.split(":");
                const order = await this.orderService.getOrderById(id);
                order.filledQuantity += BigInt(amount);
                return order;
            });

            await this.orderService.save(await Promise.all(orders))
            await this.transactionsDbService.create(transaction);
        } catch (error) {
            Logger.error("Could not update pending orders")
        }

        return { txid, status: 'success' };

    }

    async process(fillRequest: RuneFillRequest): Promise<FillRuneOrderOffer> {
        try {

            if (fillRequest.side === 'buy') {
                return this.handleBuy(fillRequest);
            } else {
                return this.handleSell(fillRequest);
            }
        } catch (error) {
            Logger.log(`Error ${error}`)
        }
    }

    private calculateBuyParams(req: RuneFillRequest, orders: RuneOrder[], runeInfo: RuneInfo) {
        let remainingFillAmount = BigInt(req.amount);
        let runeAmount = 0n;
        let order: RuneOrder;
        const selectedOrders: { order: RuneOrder, usedAmount: bigint }[] = [];
        orders.sort((a, b) => Number(a.price - b.price));

        while (order = orders.shift()) {
            const availableOrderAmount = order.quantity - order.filledQuantity;
            const availableOrderAmountInSats = Number(availableOrderAmount * order.price) / 10 ** runeInfo.decimals;

            if (availableOrderAmountInSats >= remainingFillAmount) {
                runeAmount = BigInt(Math.ceil(Number(remainingFillAmount) / Number(order.price)) * 10 ** runeInfo.decimals) as bigint;
                order.filledQuantity = BigInt(order.filledQuantity)
                order.filledQuantity += runeAmount;
                selectedOrders.push({ order, usedAmount: runeAmount });
                remainingFillAmount = 0n;
                break;
            }

            remainingFillAmount -= BigInt(Math.ceil(availableOrderAmountInSats));
            order.filledQuantity += availableOrderAmount;
            order.status = OrderStatus.CLOSED;
            runeAmount += BigInt(availableOrderAmount);
            selectedOrders.push({ order, usedAmount: availableOrderAmount });
        }

        if (remainingFillAmount > 0) {
            throw "Insufficient funds to fill this order"
        }

        return { runeAmount, selectedOrders };
    }

    private async prepareBuyPsbt(req: RuneFillRequest, runeInfo: RuneInfo, runeAmount: bigint): Promise<PreparePsbtResult> {
        const runeId = new RuneId(+runeInfo.rune_id.split(":")[0], +runeInfo.rune_id.split(":")[1]);

        // Get the collateral unspent outputs
        const runeOutputs = await this.runeService.getRunesUnspentOutputs(
            await this.walletService.getAddress(),
            runeInfo.rune_id,
            await this.walletService.getPublicKey()
        );

        if (!runeOutputs || runeOutputs.length === 0) {
            throw new OracleError(Errors.NO_RUNE_OUTPUTS_AVAILABLE);
        }

        const selectedOutputs: UnspentOutput[] = [];
        const { hasRuneChange, totalRuneAmount } = await this.selectRuneOutputs(runeOutputs, runeInfo.rune_id, runeAmount, selectedOutputs);

        let receiverOutpoint = hasRuneChange ? 2 : 1;

        const makerFee = new Decimal(runeAmount.toString()).mul(MAKER_BONUS).div(10_000).toFixed(0);
        const protocolFee = new Decimal(runeAmount.toString()).mul(PROTOCOL_FEE).div(10_000).toFixed(0);
        const totalFee = new Decimal(makerFee).plus(protocolFee).toFixed(0);
        const netAmount = new Decimal(runeAmount.toString()).minus(totalFee).toFixed(0);

        let feeEdict;
        if (+protocolFee > 0) {
            const feeOutpoint = receiverOutpoint;
            receiverOutpoint++;
            feeEdict = new Edict(runeId, BigInt(protocolFee), feeOutpoint);
        }

        const edict = new Edict(runeId, BigInt(netAmount), receiverOutpoint);
        const runestone = new Runestone([feeEdict, edict], none(), none(), none());

        const swapPsbt = new Psbt({ network: this.walletService.network });
        const sellerInputsToSign: SignableInput[] = [];

        selectedOutputs.forEach((output, index) => {
            swapPsbt.addInput(output.toInput());
            sellerInputsToSign.push({ index, signerAddress: output.address, singerPublicKey: output.publicKey, location: output.location });
        });

        // Build the transaction
        swapPsbt.addOutput({
            script: runestone.encipher(),
            value: 0
        });

        if (hasRuneChange) {
            swapPsbt.addOutput({
                address: await this.walletService.getAddress(),
                value: 546
            });
        };

        if (feeEdict) {
            swapPsbt.addOutput({
                address: PROTOCOL_FEE_OUTPUT,
                value: 546
            });
        }

        swapPsbt.addOutput({
            address: req.takerRuneAddress,
            value: 546
        });

        const feeRate = await this.bitcoinService.getFeeRate();
        const autoSplitConfig = await this.autoSplitConfigService.get('BTC');
        if (autoSplitConfig && autoSplitConfig.enabled) {
            const { maxSplits, amountPerSplit } = this.calculateSplits(
                BigInt(req.amount),
                autoSplitConfig.splitSize,
                autoSplitConfig.maxCost,
                feeRate,
                false
            );

            for (let i = 0; i < maxSplits; i++) {
                swapPsbt.addOutput({
                    address: await this.walletService.getAddress(),
                    value: Number(amountPerSplit)
                });
            }
        } else {
            swapPsbt.addOutput({
                address: await this.walletService.getAddress(),
                value: Number(req.amount)
            });
        }

        // We take a flat 1000 sat fee
        swapPsbt.addOutput({
            address: PROTOCOL_FEE_OUTPUT,
            value: 1000
        });

        // Get funding unspent outputs
        const fundingOutputs = await this.blockchainService.getValidFundingInputs(req.takerPaymentAddress, req.takerPaymentPublicKey);
        const buyerInputsToSign: SignableInput[] = [];
        const { fee } = appendUnspentOutputsAsNetworkFee(swapPsbt, fundingOutputs, [], req.takerPaymentAddress, feeRate, buyerInputsToSign);

        return { swapPsbt, buyerInputsToSign, fee, sellerInputsToSign };
    }

    async handleBuy(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);
        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.spaced_rune_name, OrderStatus.OPEN, RuneOrderType.ASK);

        // Calculate buy params
        const { runeAmount, selectedOrders } = this.calculateBuyParams(req, orders, runeInfo);

        // Prepare psbt
        const { swapPsbt, sellerInputsToSign, fee, buyerInputsToSign } = await this.prepareBuyPsbt(req, runeInfo, runeAmount);
        const psbt = this.walletService.signPsbt(swapPsbt, sellerInputsToSign.map(item => item.index));

        const priceSum = selectedOrders.reduce((prev, curr) => prev += curr.order.price, 0n);
        const avgPrice = Number(priceSum) / selectedOrders.length;

        const pendingTx = new Trade();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}`).join(",");
        pendingTx.amount = runeAmount.toString()
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = req.rune;
        pendingTx.status = TransactionStatus.PENDING;
        pendingTx.type = TransactionType.SELL;

        const { id } = await this.transactionsDbService.create(pendingTx);
        Logger.log(`Offer: Rune${runeAmount} | Sats: ${req.amount}`);
        return {
            fee,
            psbtBase64: psbt.toBase64(),
            takerInputsToSign: buyerInputsToSign,
            provider: await this.walletService.getPublicKey(),
            id
        }
    }

    async handleSell(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);
        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.spaced_rune_name, OrderStatus.OPEN, RuneOrderType.BID);

        const { quoteAmount, selectedOrders } = this.calculateSellParams(req, orders, runeInfo);
        const { swapPsbt, sellerInputsToSign, buyerInputsToSign, fee }: PreparePsbtResult = await this.prepareSellPsbt(req, runeInfo, quoteAmount);
        const psbt = this.walletService.signPsbt(swapPsbt, buyerInputsToSign.map(item => item.index));

        // Prepare psbt
        const priceSum = selectedOrders.reduce((prev, curr) => prev += curr.order.price, 0n);
        const avgPrice = Number(priceSum) / selectedOrders.length;

        const pendingTx = new Trade();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}`).join(",");
        pendingTx.amount = req.amount.toString()
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = req.rune;
        pendingTx.status = TransactionStatus.PENDING;
        pendingTx.type = TransactionType.BUY;

        const { id } = await this.transactionsDbService.create(pendingTx);

        Logger.log(`Offer: Rune${req.amount} | Sats: ${quoteAmount}`);
        return {
            fee,
            psbtBase64: psbt.toBase64(),
            takerInputsToSign: sellerInputsToSign,
            provider: await this.walletService.getPublicKey(),
            id
        }
    }

    async selectRuneOutputs(runeOutputs: UnspentOutput[], runeId: string, runeAmount: bigint, usedOutputs: UnspentOutput[]) {
        let hasRuneChange = false;
        let totalRuneAmount: bigint = 0n;

        for (const runeOutput of runeOutputs) {
            if (!runeOutput.runeIds || runeOutput.runeIds.length == 0) continue;

            const runeIdIndex = runeOutput.runeIds.findIndex(item => item === runeId);
            totalRuneAmount += runeOutput.runeBalances[runeIdIndex];
            usedOutputs.push(runeOutput);

            if (runeOutput.runeIds.length > 1 || totalRuneAmount > BigInt(runeAmount)) {
                hasRuneChange = true;
            }

            if (totalRuneAmount >= BigInt(runeAmount)) break;
        }

        if (totalRuneAmount < BigInt(runeAmount)) {
            throw new OracleError(Errors.INSUFFICIENT_RUNE_AMOUNT)
        }

        return { hasRuneChange, totalRuneAmount };
    }

    private calculateSplits(amount: bigint, splitSize: number, maxCost: number, feeRate: number, isRuneSplit: boolean): { maxSplits: number, amountPerSplit: bigint } {
        let maxSplits = Math.max(1, Math.floor(Number(amount) / splitSize));
        let totalCosts = maxSplits * 40 * feeRate + (isRuneSplit ? (maxSplits * 546) : 0);
        while (totalCosts > maxCost) {
            if (maxSplits == 1) break;
            maxSplits--;
            totalCosts = maxSplits * 40 * feeRate + (isRuneSplit ? (maxSplits * 546) : 0);
        }
        const amountPerSplit = amount / BigInt(maxSplits);
        return { maxSplits, amountPerSplit };
    };


    private calculateSellParams(req: RuneFillRequest, orders: RuneOrder[], runeInfo: RuneInfo) {
        let remainingFillAmount = BigInt(req.amount);
        let quoteAmount = 0n;
        let order: RuneOrder;
        const selectedOrders: { order: RuneOrder, usedAmount: bigint }[] = [];
        orders.sort((a, b) => Number(b.price - a.price));
        while (order = orders.shift()) {
            const availableOrderAmount = BigInt(order.quantity - order.filledQuantity);
            const availableOrderAmountInSats = Number(availableOrderAmount * BigInt(order.price)) / 10 ** runeInfo.decimals;

            if (availableOrderAmount >= remainingFillAmount) {
                let _quoteAmount = Math.floor(Number(remainingFillAmount) * Number(order.price)) / 10 ** runeInfo.decimals;
                if (_quoteAmount < 1) {
                    break;
                }
                quoteAmount = BigInt(_quoteAmount);
                order.filledQuantity += remainingFillAmount;
                selectedOrders.push({ order, usedAmount: remainingFillAmount });
                remainingFillAmount = 0n;
                break;
            }

            remainingFillAmount -= availableOrderAmount;
            order.filledQuantity += availableOrderAmount;
            order.status = OrderStatus.CLOSED;
            quoteAmount += BigInt(availableOrderAmountInSats);
            selectedOrders.push({ order, usedAmount: availableOrderAmount });
        }

        if (quoteAmount < 546n) {
            throw "Quote amount is less than dust"
        }

        if (remainingFillAmount > 0) {
            throw "Insufficient funds to fill this order"
        }

        return { quoteAmount, selectedOrders };
    }

    async prepareSellPsbt(req: RuneFillRequest, runeInfo: RuneInfo, quoteAmount: bigint): Promise<PreparePsbtResult> {

        const runeId = new RuneId(+runeInfo.rune_id.split(":")[0], +runeInfo.rune_id.split(":")[1]);

        // Get the collateral unspent outputs
        const runeOutputs = await this.runeService.getRunesUnspentOutputs(req.takerRuneAddress, runeInfo.rune_id, req.takerRunePublicKey);
        if (!runeOutputs || runeOutputs.length === 0) {
            throw new OracleError(Errors.NO_RUNE_OUTPUTS_AVAILABLE);
        }

        const selectedOutputs: UnspentOutput[] = [];
        const { totalRuneAmount, hasRuneChange } = await this.selectRuneOutputs(runeOutputs, runeInfo.rune_id, req.amount, selectedOutputs);

        const receiverOutpoint = hasRuneChange ? 2 : 1;
        const runeChange = totalRuneAmount - BigInt(req.amount);
        const runestone = new Runestone([], none(), none(), none());
        const feeRate = await this.bitcoinService.getFeeRate();

        const dummySwapPsbt = new Psbt({ network: this.walletService.network });
        const sellerInputsToSign: SignableInput[] = [];
        selectedOutputs.forEach((output, index) => {
            dummySwapPsbt.addInput(output.toInput());
            sellerInputsToSign.push({ index, signerAddress: output.address, singerPublicKey: output.publicKey, location: output.location });
        });

        // Build the transaction
        dummySwapPsbt.addOutput({
            script: runestone.encipher(),
            value: 0
        });

        const autoSplitConfig = await this.autoSplitConfigService.get(runeInfo.spaced_rune_name);
        let splitValue = 0;
        if (autoSplitConfig && autoSplitConfig.enabled) {
            const { maxSplits, amountPerSplit } = this.calculateSplits(
                BigInt(req.amount),
                autoSplitConfig.splitSize,
                autoSplitConfig.maxCost,
                feeRate,
                true
            );

            if (hasRuneChange) {
                const changeEdict = new Edict(runeId, runeChange, 0);
                runestone.edicts.push(changeEdict);
            }

            const edict = new Edict(runeId, amountPerSplit, 0);
            splitValue = maxSplits * 40 * feeRate;

            console.log("splitValue", splitValue);
            runestone.edicts.push(edict);
            for (let i = 0; i < maxSplits; i++) {
                dummySwapPsbt.addOutput({
                    address: await this.walletService.getAddress(),
                    value: 546
                });
            }
        } else {
            const edict = new Edict(runeId, req.amount, 0);
            runestone.edicts.push(edict);
            dummySwapPsbt.addOutput({
                address: await this.walletService.getAddress(),
                value: 546
            });
        }

        if (hasRuneChange) {
            dummySwapPsbt.addOutput({
                address: req.takerRuneAddress,
                value: 546
            });
        };

        const changeIndex = dummySwapPsbt.txOutputs.length - 1;

        const makerFee = new Decimal(quoteAmount.toString()).mul(MAKER_BONUS).div(10_000).floor().toFixed(0);
        const protocolFee = new Decimal(quoteAmount.toString()).mul(PROTOCOL_FEE).div(10_000).floor().toFixed(0);
        const totalFee = new Decimal(makerFee).plus(protocolFee).toFixed();
        const netAmount = new Decimal(quoteAmount.toString()).minus(totalFee).plus(splitValue.toString());

        dummySwapPsbt.addOutput({
            address: req.takerPaymentAddress,
            value: Number(netAmount)
        });

        const amountOutputIndex = dummySwapPsbt.txOutputs.length - 1;

        // We take a flat 1000 sat fee
        dummySwapPsbt.addOutput({
            address: PROTOCOL_FEE_OUTPUT,
            value: 1000 + +protocolFee
        });

        // Get funding unspent outputs
        const fundingOutputs = await this.blockchainService.getValidFundingInputs(
            await this.walletService.getAddress(),
            await this.walletService.getPublicKey()
        );

        const buyerInputsToSign: SignableInput[] = [];
        const { fee, psbt: newPsbt } = takeNetowrkFeeFromOutput(dummySwapPsbt,
            amountOutputIndex,
            feeRate + 2,
            await this.walletService.getAddress(),
            fundingOutputs,
            buyerInputsToSign,
        );


        const swapPsbt = new Psbt({ network: this.walletService.network });
        newPsbt.txInputs.forEach((_, index) => swapPsbt.addInput({
            ...newPsbt.data.globalMap.unsignedTx['tx'].ins[index],
            ...newPsbt.data.inputs[index],
        }));

        if (hasRuneChange) {
            runestone.edicts[0].output = changeIndex;
            runestone.edicts[1].output = newPsbt.txOutputs.length;
        } else {
            runestone.edicts[0].output = newPsbt.txOutputs.length;
        }

        newPsbt.txOutputs.forEach((_, index) => {
            if (index === 0) {
                swapPsbt.addOutput({
                    script: runestone.encipher(),
                    value: newPsbt.txOutputs[index].value,
                });
                return;
            }
            swapPsbt.addOutput({
                address: newPsbt.txOutputs[index].address,
                value: newPsbt.txOutputs[index].value,
            });
        });

        console.log(Transaction.fromBuffer(swapPsbt.data.getTransaction()).virtualSize());

        return { swapPsbt, sellerInputsToSign, buyerInputsToSign, fee };
    }
}
