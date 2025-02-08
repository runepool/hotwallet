import { BlockchainService } from '@app/blockchain';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { SignableInput, UnspentOutput } from '@app/blockchain/bitcoin/types/UnspentOutput';
import { appendUnspentOutputsAsNetworkFee, takeNetowrkFeeFromOutput } from '@app/blockchain/psbtUtils';
import { RunesService } from '@app/blockchain/runes/runes.service';

import { RuneInfo } from '@app/blockchain/runes/types';

import { OrderStatus, RuneOrder, RuneOrderType } from '@app/exchange-database/entities/rune-order.entity';
import { TransactionStatus, Transaction as Trade } from '@app/exchange-database/entities/transaction.entity';
import { RuneOrdersService } from '@app/exchange-database/rune-orders/rune-orders-database.service';
import { NostrService } from '@app/nostr';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Errors, OracleError } from 'libs/errors/errors';
import { Event } from 'nostr-tools';
import { Edict, none, RuneId, Runestone } from 'runelib';
import { MakerGatewayService } from './maker-gateway/maker-gateway.service';
import { FillRuneOrderOffer, RuneFillRequest, SwapMessage, SwapResult, SwapTransaction, SelectedOrder } from './types';
import { TransactionType } from '@app/database/entities/transaction.entity';
import { TransactionsDbService } from '@app/exchange-database/transactions/transactions-database.service';

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
export class RuneEngineService {
    constructor(
        private readonly orderService: RuneOrdersService,
        private readonly bitcoinService: BitcoinService,
        private readonly walletService: BitcoinWalletService,
        private readonly runeService: RunesService,
        private readonly transactionsDbService: TransactionsDbService,
        private readonly blockchainService: BlockchainService,
        private readonly nostrService: NostrService,
        private readonly makerGatewayService: MakerGatewayService
    ) { }


    // async finalize(swap: SwapTransaction): Promise<SwapResult> {
    //     const psbt = Psbt.fromBase64(swap.signedBase64Psbt);
    //     const tx = psbt.extractTransaction();
    //     const transaction = await this.transactionsDbService.findById(swap.offerId);

    //     if (!transaction) {
    //         throw "Transaction not found";
    //     }

    //     const txid = await this.bitcoinService.broadcast(tx.toHex());

    //     transaction.status = TransactionStatus.CONFIRMING;
    //     transaction.txid = txid;

    //     try {
    //         const orders = transaction.orders.split(",").map(async item => {
    //             const [id, amount] = item.split(":");
    //             const order = await this.orderService.getOrderById(id);
    //             order.filledQuantity += BigInt(amount);
    //             return order;
    //         });

    //         await this.orderService.save(await Promise.all(orders))
    //         await this.transactionsDbService.create(transaction);
    //     } catch (error) {
    //         Logger.error("Could not update pending orders")
    //     }

    //     return { txid, status: 'success' };

    // }

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


    async handleBuy(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);
        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.spaced_rune_name, OrderStatus.OPEN, RuneOrderType.ASK);

        const tradeId = randomUUID();

        // Calculate buy params
        const { runeAmount, selectedOrders } = await this.reserveAskOrders(req, orders, runeInfo, tradeId);

        // Prepare psbt
        const { swapPsbt, sellerInputsToSign, fee, buyerInputsToSign } = await this.prepareBuyPsbt(req, runeInfo, runeAmount, selectedOrders);
        const psbt = await this.makerGatewayService.signPsbt(swapPsbt, sellerInputsToSign, selectedOrders.map(item => item.order), tradeId);

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

        const tradeId = randomUUID();
        const { quoteAmount, selectedOrders } = await this.reserveBidOrders(req, orders, runeInfo, tradeId);
        const { swapPsbt, sellerInputsToSign, buyerInputsToSign, fee }: PreparePsbtResult = await this.prepareSellPsbt(req, runeInfo, quoteAmount, selectedOrders);
        const psbt = await this.makerGatewayService.signPsbt(swapPsbt, buyerInputsToSign, selectedOrders.map(item => item.order), tradeId);

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
        const change = totalRuneAmount - BigInt(runeAmount);

        return { hasRuneChange, totalRuneAmount, change };
    }

    async reserveBidOrders(req: RuneFillRequest, orders: RuneOrder[], runeInfo: RuneInfo, tradeId: string) {
        let remainingFillAmount = BigInt(req.amount);
        let quoteAmount = 0n;
        let order: RuneOrder;
        const selectedOrders: SelectedOrder[] = [];
        orders.sort((a, b) => Number(b.price - a.price));

        const satBalance: {
            [maker_address: string]: {
                balance: bigint,
                outputs: UnspentOutput[]
            }
        } = {};

        while (order = orders.shift()) {
            if (!satBalance[order.makerAddress]) {
                const outputs = await this.blockchainService.getValidFundingInputs(order.makerAddress, order.makerPublicKey);
                const balance = outputs.reduce((prev, curr) => prev + BigInt(curr.amount), 0n);
                satBalance[order.makerAddress] = {
                    balance,
                    outputs
                };
            }

            const { balance, outputs } = satBalance[order.makerAddress];

            const availableOrderAmount = BigInt(order.quantity - order.filledQuantity);
            const availableOrderAmountInSats = Number(availableOrderAmount * BigInt(order.price)) / 10 ** runeInfo.decimals;

            if (availableOrderAmount >= remainingFillAmount) {
                let _quoteAmount = Math.floor(Number(remainingFillAmount) * Number(order.price)) / 10 ** runeInfo.decimals;
                if (_quoteAmount < 1) {
                    break;
                }
                quoteAmount = BigInt(_quoteAmount);
                if (balance < quoteAmount) {
                    continue;
                }

                const { status } = await this.makerGatewayService.reserveOrder(order, remainingFillAmount, tradeId);
                if (status === 'error') {
                    continue;
                }

                order.filledQuantity += remainingFillAmount;
                selectedOrders.push({ order, usedAmount: remainingFillAmount, satAmount: BigInt(_quoteAmount), outputs });
                remainingFillAmount = 0n;
                break;
            }


            if (balance < availableOrderAmountInSats) {
                continue;
            }

            const { status } = await this.makerGatewayService.reserveOrder(order, availableOrderAmount, tradeId);
            if (status === 'error') {
                continue;
            }

            remainingFillAmount -= availableOrderAmount;
            order.filledQuantity += availableOrderAmount;
            order.status = OrderStatus.CLOSED;
            quoteAmount += BigInt(availableOrderAmountInSats);
            selectedOrders.push({ order, usedAmount: availableOrderAmount, satAmount: BigInt(availableOrderAmountInSats), outputs });
        }

        if (quoteAmount < 546n) {
            throw "Quote amount is less than dust"
        }

        if (remainingFillAmount > 0) {
            throw "Insufficient funds to fill this order"
        }

        return { quoteAmount, selectedOrders };
    }

    async reserveAskOrders(req: RuneFillRequest, orders: RuneOrder[], runeInfo: RuneInfo, tradeId: string) {
        let remainingFillAmount = BigInt(req.amount);
        let runeAmount = 0n;
        let order: RuneOrder;
        const selectedOrders: SelectedOrder[] = [];
        orders.sort((a, b) => Number(a.price - b.price));

        const runeBalances: {
            [maker_address: string]: {
                balance: bigint,
                outputs: UnspentOutput[]
            }
        } = {};

        while (order = orders.shift()) {
            if (!runeBalances[order.makerAddress]) {
                const { availableRuneAmount, unspentOutputs } = await this.getAvailableRuneInfo(order, runeInfo);
                runeBalances[order.makerAddress] = {
                    balance: availableRuneAmount,
                    outputs: unspentOutputs
                };
            }

            const { balance, outputs } = runeBalances[order.makerAddress];

            const availableOrderAmount = order.quantity - order.filledQuantity;
            const availableOrderAmountInSats = Number(availableOrderAmount * order.price) / 10 ** runeInfo.decimals;

            if (availableOrderAmountInSats >= remainingFillAmount) {
                runeAmount = BigInt(Math.ceil(Number(remainingFillAmount) / Number(order.price)) * 10 ** runeInfo.decimals) as bigint;
                if (balance < runeAmount) {
                    continue;
                }

                const { status } = await this.makerGatewayService.reserveOrder(order, runeAmount, tradeId);
                if (status === 'error') {
                    continue;
                }

                runeBalances[order.makerAddress].balance -= runeAmount;
                order.filledQuantity = BigInt(order.filledQuantity)
                order.filledQuantity += runeAmount;
                selectedOrders.push({ order, usedAmount: runeAmount, outputs, satAmount: remainingFillAmount });
                remainingFillAmount = 0n;
                break;
            }

            if (balance < availableOrderAmount) {
                continue;
            }

            const { status } = await this.makerGatewayService.reserveOrder(order, runeAmount, tradeId);
            if (status === 'error') {
                continue;
            }

            remainingFillAmount -= BigInt(Math.ceil(availableOrderAmountInSats));
            runeBalances[order.makerAddress].balance -= availableOrderAmount;
            order.filledQuantity += availableOrderAmount;
            order.status = OrderStatus.CLOSED;
            runeAmount += BigInt(availableOrderAmount);
            selectedOrders.push({ order, usedAmount: availableOrderAmount, outputs, satAmount: BigInt(availableOrderAmountInSats) });
        }

        if (remainingFillAmount > 0) {
            throw "Insufficient funds to fill this order"
        }

        return { runeAmount, selectedOrders };
    }

    async prepareSellPsbt(req: RuneFillRequest, runeInfo: RuneInfo, quoteAmount: bigint, orders: SelectedOrder[]): Promise<PreparePsbtResult> {

        const runeId = new RuneId(+runeInfo.rune_id.split(":")[0], +runeInfo.rune_id.split(":")[1]);
        const runestone = new Runestone([], none(), none(), none());
        const swapPsbt = new Psbt({ network: this.walletService.network });

        // Get the collateral unspent outputs
        const runeOutputs = await this.runeService.getRunesUnspentOutputs(req.takerRuneAddress, runeInfo.rune_id, req.takerRunePublicKey);
        if (!runeOutputs || runeOutputs.length === 0) {
            throw new OracleError(Errors.NO_RUNE_OUTPUTS_AVAILABLE);
        }

        const selectedOutputs: UnspentOutput[] = [];
        const { hasRuneChange } = await this.selectRuneOutputs(runeOutputs, runeInfo.rune_id, req.amount, selectedOutputs);

        const sellerInputsToSign: SignableInput[] = [];
        for (const output of selectedOutputs) {
            swapPsbt.addInput(output.toInput());
            sellerInputsToSign.push({ index: swapPsbt.data.inputs.length - 1, signerAddress: output.address, singerPublicKey: output.publicKey, location: output.location });
        }

        let runeSatsChange = selectedOutputs.reduce((prev, curr) => prev + BigInt(curr.amount), 0n);
        if (hasRuneChange) {
            swapPsbt.addOutput({
                address: req.takerRuneAddress,
                value: 546
            });

            runeSatsChange -= 546n;
        }

        const oderGroup: { [maker_address: string]: SelectedOrder[] } = {};

        for (const order of orders) {
            oderGroup[order.order.makerAddress] = oderGroup[order.order.makerAddress] || [];
            oderGroup[order.order.makerAddress].push(order);
        }

        const indexOffset = hasRuneChange ? 1 : 0;
        for (const [makerAddress, selectedOrders] of Object.entries(oderGroup)) {
            const totalRuneAmount = selectedOrders.reduce((prev, curr) => prev + curr.usedAmount, 0n);
            swapPsbt.addOutput({
                address: makerAddress,
                value: 546
            });
            runeSatsChange -= 546n;
            runestone.edicts.push(new Edict(runeId, BigInt(totalRuneAmount), indexOffset + swapPsbt.txOutputs.length - 1));
        }

        swapPsbt.addOutput({
            script: runestone.encipher(),
            value: 0
        });


        const makerFee = new Decimal(quoteAmount.toString()).mul(MAKER_BONUS).div(10_000).floor().toFixed(0);
        const protocolFee = new Decimal(quoteAmount.toString()).mul(PROTOCOL_FEE).div(10_000).floor().toFixed(0);
        const totalFee = new Decimal(makerFee).plus(protocolFee).toFixed();
        const netAmount = new Decimal(quoteAmount.toString()).minus(totalFee).plus(runeSatsChange.toString());

        // The seller nbtc 
        swapPsbt.addOutput({
            address: req.takerPaymentAddress,
            value: Number(netAmount)
        })

        const amountOutputIndex = swapPsbt.txOutputs.length - 1;

        swapPsbt.addOutput({
            address: PROTOCOL_FEE_OUTPUT,
            value: Number(protocolFee)
        });

        const fundingInputs: UnspentOutput[] = [];

        for (const [_, selectedOrders] of Object.entries(oderGroup)) {
            const { outputs } = selectedOrders[0];
            for (const output of outputs) {
                const existingOutput = fundingInputs.find(item => item.location === output.location);
                if (!existingOutput) {
                    fundingInputs.push(output);
                }
            }
        }


        const buyerInputsToSign: SignableInput[] = [];
        const feeRate = await this.bitcoinService.getFeeRate();
        const { fee, psbt } = takeNetowrkFeeFromOutput(swapPsbt,
            amountOutputIndex,
            feeRate + 2,
            await this.walletService.getAddress(),
            fundingInputs,
            buyerInputsToSign,
        );

        console.log(Transaction.fromBuffer(swapPsbt.data.getTransaction()).virtualSize());

        return { swapPsbt: psbt, sellerInputsToSign, buyerInputsToSign, fee };
    }

    async prepareBuyPsbt(req: RuneFillRequest, runeInfo: RuneInfo, runeAmount: bigint, orders: SelectedOrder[]): Promise<PreparePsbtResult> {
        const runeId = new RuneId(+runeInfo.rune_id.split(":")[0], +runeInfo.rune_id.split(":")[1]);
        const swapPsbt = new Psbt({ network: this.walletService.network });
        const runestone = new Runestone([], none(), none(), none());

        swapPsbt.addOutput({
            address: req.takerRuneAddress,
            value: 546
        });

        const makerFee = new Decimal(runeAmount.toString()).mul(MAKER_BONUS).div(10_000).toFixed(0);
        const protocolFee = new Decimal(runeAmount.toString()).mul(PROTOCOL_FEE).div(10_000).toFixed(0);
        const totalFee = new Decimal(makerFee).plus(protocolFee).toFixed(0);
        const netAmount = new Decimal(runeAmount.toString()).minus(totalFee).toFixed(0);


        runestone.edicts.push(new Edict(runeId, BigInt(netAmount), swapPsbt.txOutputs.length - 1));
        const oderGroup: { [maker_address: string]: SelectedOrder[] } = {};

        for (const order of orders) {
            oderGroup[order.order.makerAddress] = oderGroup[order.order.makerAddress] || [];
            oderGroup[order.order.makerAddress].push(order);
        }

        const sellerInputsToSign: SignableInput[] = [];

        for (const [makerAddress, selectedOrders] of Object.entries(oderGroup)) {
            const selectedOutputs: UnspentOutput[] = [];
            const requiredAmount = selectedOrders.reduce((prev, curr) => prev + curr.usedAmount, 0n);
            const { hasRuneChange, totalRuneAmount, change } = await this.selectRuneOutputs(selectedOrders[0].outputs, runeInfo.rune_id, requiredAmount, selectedOutputs);

            selectedOutputs.forEach(output => {
                swapPsbt.addInput(output.toInput());
                sellerInputsToSign.push({ index: swapPsbt.data.inputs.length - 1, signerAddress: output.address, singerPublicKey: output.publicKey, location: output.location });
            })

            if (hasRuneChange) {
                swapPsbt.addOutput({
                    address: makerAddress,
                    value: 546
                });
                runestone.edicts.push(new Edict(runeId, BigInt(change), swapPsbt.txOutputs.length - 1));
            }
        }

        if (+protocolFee > 0) {
            swapPsbt.addOutput({
                address: PROTOCOL_FEE_OUTPUT,
                value: 546
            });
            runestone.edicts.push(new Edict(runeId, BigInt(protocolFee), swapPsbt.txOutputs.length - 1));
        }

        // Build the transaction
        swapPsbt.addOutput({
            script: runestone.encipher(),
            value: 0
        });

        for (const [makerAddress, selectedOrders] of Object.entries(oderGroup)) {
            const totalSatAmount = selectedOrders.reduce((prev, curr) => prev + curr.satAmount, 0n);
            swapPsbt.addOutput({
                address: makerAddress,
                value: Number(totalSatAmount)
            });
        }

        swapPsbt.addOutput({
            address: await this.walletService.getAddress(),
            value: Number(req.amount)
        });

        // We take a flat 1000 sat fee
        swapPsbt.addOutput({
            address: PROTOCOL_FEE_OUTPUT,
            value: 1000
        });

        // Get funding unspent outputs
        const feeRate = await this.bitcoinService.getFeeRate();
        const fundingOutputs = await this.blockchainService.getValidFundingInputs(req.takerPaymentAddress, req.takerPaymentPublicKey);
        const buyerInputsToSign: SignableInput[] = [];
        const { fee } = appendUnspentOutputsAsNetworkFee(swapPsbt, fundingOutputs, [], req.takerPaymentAddress, feeRate, buyerInputsToSign);

        return { swapPsbt, buyerInputsToSign, fee, sellerInputsToSign };
    }

    async getAvailableRuneInfo(order: RuneOrder, runeInfo: RuneInfo) {
        const unspentOutputs = await this.runeService.getRunesUnspentOutputs(order.makerAddress, runeInfo.rune_id);
        const availableRuneAmount = unspentOutputs.reduce((prev, curr) => {
            const runeIdIndex = curr.runeIds.findIndex(item => item === runeInfo.rune_id);
            if (runeIdIndex === -1) {
                return prev;
            }
            return prev + curr.runeBalances[runeIdIndex];
        }, 0n);
        return { availableRuneAmount, unspentOutputs };
    }

}
