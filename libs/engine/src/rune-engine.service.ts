import { BlockchainService } from '@app/blockchain';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { SignableInput, UnspentOutput } from '@app/blockchain/bitcoin/types/UnspentOutput';
import { appendUnspentOutputsAsNetworkFee, sumInputsValues, takeNetowrkFeeFromOutput } from '@app/blockchain/psbtUtils';
import { RunesService } from '@app/blockchain/runes/runes.service';
import { RuneInfo } from '@app/blockchain/runes/types';
import { TransactionType } from '@app/database/entities/transaction.entity';
import { OrderStatus, RuneOrder, RuneOrderType } from '@app/exchange-database/entities/rune-order.entity';
import { Transaction as Trade, TransactionStatus } from '@app/exchange-database/entities/transaction.entity';
import { RuneOrdersService } from '@app/exchange-database/rune-orders/rune-orders-database.service';
import { TransactionsDbService } from '@app/exchange-database/transactions/transactions-database.service';
import { MAKER_BONUS, PROTOCOL_FEE, PROTOCOL_FEE_OUTPUT } from '@app/nostr/constants';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger } from '@nestjs/common';
import { ExecuteTradeDto } from 'apps/exchange/src/dto/trade.dto';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Errors, OracleError } from 'libs/errors/errors';
import { Edict, none, RuneId, Runestone } from 'runelib';
import { MakerGatewayService } from './maker-gateway/maker-gateway.service';
import { FillRuneOrderOffer, RuneFillRequest, SelectedOrder, SwapResult } from './types';
import { calculateTransactionSize } from '@app/blockchain/bitcoin/utils';
import { Cron, CronExpression } from '@nestjs/schedule';

interface PreparePsbtResult {
    swapPsbt: Psbt;
    buyerInputsToSign: SignableInput[];
    sellerInputsToSign: SignableInput[];
    fee: number;
}

interface ReserveConfiguration {
    tradeId: string;
}

@Injectable()
export class RuneEngineService {

    checkingMarketMakers = false;

    constructor(
        private readonly orderService: RuneOrdersService,
        private readonly bitcoinService: BitcoinService,
        private readonly walletService: BitcoinWalletService,
        private readonly runeService: RunesService,
        private readonly transactionsDbService: TransactionsDbService,
        private readonly blockchainService: BlockchainService,
        private readonly makerGatewayService: MakerGatewayService
    ) { }

    /**
     * Periodically checks the health of market makers by sending ping messages
     * This helps identify which market makers are online and responsive
     */
    @Cron(CronExpression.EVERY_10_SECONDS)
    async checkMarketMakers() {
        try {
            if (this.checkingMarketMakers) {
                return;
            }

            this.checkingMarketMakers = true;
            // Get all active makers with open orders
            const activeMakers = await this.orderService.getActiveMakers();

            if (activeMakers.length === 0) {
                return;
            }

            Logger.log(`Checking health of ${activeMakers.length} active market makers`);

            // Send ping message to each active maker
            for (const maker of activeMakers) {
                try {
                    await this.makerGatewayService.pingMaker(maker.makerNostrKey);
                } catch (error) {
                    Logger.warn(`Failed to ping market maker ${maker.makerNostrKey}: ${error.message}`);
                    // Remove the maker's orders since they are unresponsive
                    try {
                        const deletedCount = await this.orderService.deleteOrdersByMaker(maker.makerPublicKey);
                        if (deletedCount > 0) {
                            Logger.log(`Removed ${deletedCount} orders from unresponsive market maker ${maker.makerNostrKey}`);
                        }
                    } catch (deleteError) {
                        Logger.error(`Failed to delete orders from unresponsive maker ${maker.makerNostrKey}: ${deleteError.message}`);
                    }
                }
            }
        } catch (error) {
            Logger.error(`Error checking market makers: ${error.message}`);
        } finally {
            this.checkingMarketMakers = false;
        }
    }


    async finalize(swap: ExecuteTradeDto): Promise<SwapResult> {
        const psbt = Psbt.fromBase64(swap.signedBase64Psbt);
        const transaction = await this.transactionsDbService.findById(swap.tradeId);

        if (!transaction) {
            throw "Transaction not found";
        }

        const makerPsbt = Psbt.fromBase64(transaction.psbt);
        const finalPsbt = psbt.combine(makerPsbt);
        const tx = finalPsbt.finalizeAllInputs().extractTransaction();

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
            await this.transactionsDbService.save([transaction]);
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


    async handleBuy(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);

        const tradeId = randomUUID();

        // Calculate buy params
        const { runeAmount, selectedOrders } = await this.reserveAskOrders(BigInt(req.amount), runeInfo, { tradeId });

        // Prepare psbt
        const { swapPsbt, sellerInputsToSign, fee, buyerInputsToSign } = await this.prepareBuyPsbt(req, runeInfo, runeAmount, selectedOrders);
        const psbt = await this.makerGatewayService.signPsbt(swapPsbt, sellerInputsToSign, selectedOrders.map(item => item.order), tradeId);

        const priceSum = selectedOrders.reduce((prev, curr) => prev += curr.order.price, 0n);
        const avgPrice = Number(priceSum) / selectedOrders.length;

        const pendingTx = new Trade();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}:${item.order.price}`).join(",");
        pendingTx.amount = runeAmount.toString()
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = req.rune;
        pendingTx.status = TransactionStatus.PENDING;
        pendingTx.type = TransactionType.SELL;
        pendingTx.psbt = psbt.toBase64();

        const { id } = await this.transactionsDbService.create(pendingTx);
        Logger.log(`Offer: Rune${runeAmount} | Sats: ${req.amount}`);
        return {
            fee,
            psbtBase64: swapPsbt.toBase64(),
            takerInputsToSign: buyerInputsToSign,
            id
        }
    }

    async handleSell(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);

        const tradeId = randomUUID();
        const { quoteAmount, selectedOrders } = await this.reserveBidOrders(BigInt(req.amount), runeInfo, { tradeId });
        const { swapPsbt, sellerInputsToSign, buyerInputsToSign, fee }: PreparePsbtResult = await this.prepareSellPsbt(req, runeInfo, quoteAmount, selectedOrders);
        const psbt = await this.makerGatewayService.signPsbt(swapPsbt, buyerInputsToSign, selectedOrders.map(item => item.order), tradeId);

        // Prepare psbt
        const priceSum = selectedOrders.reduce((prev, curr) => prev += curr.order.price, 0n);
        const avgPrice = Number(priceSum) / selectedOrders.length;

        const pendingTx = new Trade();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}:${item.order.price}`).join(",");
        pendingTx.amount = req.amount.toString()
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = req.rune;
        pendingTx.status = TransactionStatus.PENDING;
        pendingTx.type = TransactionType.BUY;
        pendingTx.psbt = psbt.toBase64();

        const { id } = await this.transactionsDbService.create(pendingTx);

        Logger.log(`Offer: Rune${req.amount} | Sats: ${quoteAmount}`);
        return {
            fee,
            psbtBase64: swapPsbt.toBase64(),
            takerInputsToSign: sellerInputsToSign,
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

    async reserveBidOrders(amount: bigint, runeInfo: RuneInfo, reserveConfig?: ReserveConfiguration) {
        let remainingFillAmount = amount;
        let quoteAmount = 0n;
        let order: RuneOrder;

        const selectedOrders: SelectedOrder[] = [];

        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.spaced_rune_name, OrderStatus.OPEN, RuneOrderType.BID);
        orders.sort((a, b) => Number(b.price - a.price));

        const satBalance: {
            [maker_address: string]: {
                balance: bigint,
                outputs: UnspentOutput[]
            }
        } = {};

        // Use a cursor here to get the errors
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

            // Use Decimal.js for precise calculations
            const decimalPrice = new Decimal(order.price.toString());
            const decimalAvailableAmount = new Decimal(availableOrderAmount.toString());
            const decimalDecimals = new Decimal(10).pow(runeInfo.decimals);

            // Calculate available amount in sats with proper precision
            const availableOrderAmountInSats = decimalAvailableAmount
                .times(decimalPrice)
                .dividedBy(decimalDecimals);

            if (availableOrderAmount >= remainingFillAmount) {
                // Calculate quote amount with proper precision
                const decimalRemainingFill = new Decimal(remainingFillAmount.toString());
                const quoteAmountDecimal = decimalRemainingFill
                    .times(decimalPrice)
                    .dividedBy(decimalDecimals)
                    .floor(); // Floor to ensure we don't exceed

                // Skip if quote amount is less than dust
                if (quoteAmountDecimal.lessThan(546)) {
                    break;
                }

                const _quoteAmount = BigInt(quoteAmountDecimal.toString());
                if (balance < _quoteAmount) {
                    continue;
                }

                let reservedUtxos: string[] = [];
                if (reserveConfig) {
                    const { status, reservedUtxos: _reservedUtxos } = await this.makerGatewayService.reserveOrder(order, remainingFillAmount, reserveConfig.tradeId);
                    if (status === 'error') {
                        continue;
                    }
                    reservedUtxos = _reservedUtxos;
                }

                order.filledQuantity += remainingFillAmount;
                const selectedOutputs = outputs.filter(item => reservedUtxos.includes(item.location));
                selectedOrders.push({ order, usedAmount: remainingFillAmount, satAmount: _quoteAmount, outputs: selectedOutputs });
                quoteAmount += _quoteAmount;
                remainingFillAmount = 0n;
                break;
            }

            // Convert to BigInt to ensure we don't lose precision
            const availableSatsAmount = BigInt(availableOrderAmountInSats.floor().toString());
            if (balance < availableSatsAmount) {
                continue;
            }

            let reservedUtxos: string[] = [];
            if (reserveConfig) {
                const { status, reservedUtxos: _reservedUtxos } = await this.makerGatewayService.reserveOrder(order, availableOrderAmount, reserveConfig.tradeId);
                if (status === 'error') {
                    continue;
                }
                reservedUtxos = _reservedUtxos;
            }

            remainingFillAmount -= availableOrderAmount;
            order.filledQuantity += availableOrderAmount;
            order.status = OrderStatus.CLOSED;
            quoteAmount += availableSatsAmount;
            const selectedOutputs = outputs.filter(item => reservedUtxos.includes(item.location));
            selectedOrders.push({ order, usedAmount: availableOrderAmount, satAmount: availableSatsAmount, outputs: selectedOutputs });
        }

        if (quoteAmount < 546n) {
            throw new OracleError(Errors.INSUFFICIENT_FUNDS);
        }

        if (remainingFillAmount > 0) {
            throw new OracleError(Errors.INSUFFICIENT_FUNDS);
        }

        return { quoteAmount, selectedOrders };
    }

    async reserveAskOrders(amount: bigint, runeInfo: RuneInfo, reserveConfig?: ReserveConfiguration) {
        let remainingFillAmount = amount;
        let runeAmount = 0n;
        let order: RuneOrder;
        const selectedOrders: SelectedOrder[] = [];

        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.spaced_rune_name, OrderStatus.OPEN, RuneOrderType.ASK);

        orders.sort((a, b) => Number(a.price - b.price));

        const runeBalances: {
            [maker_address: string]: {
                balance: bigint,
                outputs: UnspentOutput[]
            }
        } = {};

        while (order = orders.shift()) {
            if (!runeBalances[order.makerAddress]) {
                const { availableRuneAmount, unspentOutputs } = await this.getAvailableRuneInfo(order, runeInfo, order.makerPublicKey);
                runeBalances[order.makerAddress] = {
                    balance: availableRuneAmount,
                    outputs: unspentOutputs
                };
            }

            const { balance, outputs } = runeBalances[order.makerAddress];

            const availableOrderAmount = order.quantity - order.filledQuantity;

            // Use Decimal.js for precise calculations
            const decimalPrice = new Decimal(order.price.toString());
            const decimalAvailableAmount = new Decimal(availableOrderAmount.toString());
            const decimalDecimals = new Decimal(10).pow(runeInfo.decimals);

            // Calculate available amount in sats with proper precision
            const availableOrderAmountInSats = decimalAvailableAmount
                .times(decimalPrice)
                .dividedBy(decimalDecimals)
                .toNumber();

            if (availableOrderAmountInSats >= remainingFillAmount) {
                // Calculate required rune amount with proper precision
                const decimalRemainingFill = new Decimal(remainingFillAmount.toString());
                const runeAmountDecimal = decimalRemainingFill
                    .dividedBy(decimalPrice)
                    .times(decimalDecimals)
                    .ceil();

                runeAmount = BigInt(runeAmountDecimal.toString());

                if (balance < runeAmount) {
                    continue;
                }

                let reservedUtxos: string[] = [];
                if (reserveConfig) {
                    const { status, reservedUtxos: _reservedUtxos } = await this.makerGatewayService.reserveOrder(order, runeAmount, reserveConfig.tradeId);
                    if (status === 'error') {
                        continue;
                    }
                    reservedUtxos = reservedUtxos;
                }

                runeBalances[order.makerAddress].balance -= runeAmount;
                order.filledQuantity += runeAmount;
                const selectedOutputs = outputs.filter(item => reservedUtxos.includes(item.location));

                selectedOrders.push({ order, usedAmount: runeAmount, outputs: selectedOutputs, satAmount: remainingFillAmount });
                remainingFillAmount = 0n;
                break;
            }

            if (balance < availableOrderAmount) {
                continue;
            }

            let reservedUtxos: string[] = [];
            if (reserveConfig) {
                const { status, reservedUtxos: _reservedUtxos } = await this.makerGatewayService.reserveOrder(order, availableOrderAmount, reserveConfig.tradeId);
                if (status === 'error') {
                    continue;
                }
                reservedUtxos = _reservedUtxos;
            }

            // Convert to BigInt after ceiling to ensure we don't underestimate
            const satAmountBigInt = BigInt(Math.ceil(availableOrderAmountInSats));
            remainingFillAmount -= satAmountBigInt;

            runeBalances[order.makerAddress].balance -= availableOrderAmount;
            order.filledQuantity += availableOrderAmount;
            order.status = OrderStatus.CLOSED;
            runeAmount += availableOrderAmount;

            const selectedOutputs = outputs.filter(item => reservedUtxos.includes(item.location));
            selectedOrders.push({
                order,
                usedAmount: availableOrderAmount,
                outputs: selectedOutputs,
                satAmount: satAmountBigInt
            });
        }

        if (remainingFillAmount > 0) {
            throw new OracleError(Errors.INSUFFICIENT_FUNDS);
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

        for (const [makerAddress, selectedOrders] of Object.entries(oderGroup)) {
            const totalRuneAmount = selectedOrders.reduce((prev, curr) => prev + curr.usedAmount, 0n);
            swapPsbt.addOutput({
                address: makerAddress,
                value: 546
            });
            runeSatsChange -= 546n;
            runestone.edicts.push(new Edict(runeId, BigInt(totalRuneAmount), swapPsbt.txOutputs.length - 1));
        }

        swapPsbt.addOutput({
            script: runestone.encipher(),
            value: 0
        });


        const fundingInputs: UnspentOutput[] = [];
        let totalMakerFee = 0;
        for (const [makerAddress, selectedOrders] of Object.entries(oderGroup)) {
            // All orders hold the same outputs 
            const { outputs } = selectedOrders[0];
            let totalSatAmount = selectedOrders.reduce((prev, curr) => prev + Number(curr.satAmount), 0);
            const makerFee = new Decimal(totalSatAmount.toString()).mul(MAKER_BONUS).div(10_000).floor().toFixed(0);
            totalSatAmount -= +makerFee;
            totalMakerFee += +makerFee;
            let totalAmountUsed = 0;
            for (const output of outputs) {
                const existingOutput = fundingInputs.find(item => item.location === output.location);
                if (!existingOutput) {
                    fundingInputs.push(output);
                    totalAmountUsed += output.amount;
                }
            }

            const change = totalAmountUsed - totalSatAmount;
            if (change < 0) {
                throw new OracleError(Errors.INSUFFICIENT_RUNE_AMOUNT)
            };

            if (change > 546) {
                swapPsbt.addOutput({
                    address: makerAddress,
                    value: change
                });
            }
        }

        const buyerInputsToSign: SignableInput[] = [];
        for (const output of fundingInputs) {
            swapPsbt.addInput(output.toInput());
            buyerInputsToSign.push({ index: swapPsbt.data.inputs.length - 1, signerAddress: output.address, singerPublicKey: output.publicKey, location: output.location });
        }

        const feeTx = swapPsbt.clone().addOutput({
            address: req.takerPaymentAddress,
            value: 1000
        }).addOutput({
            address: PROTOCOL_FEE_OUTPUT,
            value: 1000
        });

        const txSize = calculateTransactionSize(feeTx.data.inputs, feeTx.txOutputs, []);
        const feeRate = await this.bitcoinService.getFeeRate();
        const fee = Math.ceil(feeRate * txSize) + 1000;

        const protocolFee = new Decimal(quoteAmount.toString()).mul(PROTOCOL_FEE).div(10_000).floor().toFixed(0);
        const totalFee = new Decimal(totalMakerFee).plus(protocolFee).toFixed();
        const netAmount = new Decimal(quoteAmount.toString()).minus(totalFee).plus(runeSatsChange.toString()).sub(fee).toFixed(0);

        // The seller nbtc 
        swapPsbt.addOutput({
            address: req.takerPaymentAddress,
            value: Number(netAmount)
        })

        swapPsbt.addOutput({
            address: PROTOCOL_FEE_OUTPUT,
            value: Number(+protocolFee + 1000)
        });

        const totalIn = swapPsbt.data.inputs.reduce(sumInputsValues(swapPsbt), 0);
        const totalOut = swapPsbt.txOutputs.reduce((prev, curr) => prev + curr.value, 0);
        if (totalIn < totalOut) {
            throw new OracleError(Errors.INSUFFICIENT_FUNDS)
        }
        return { swapPsbt, sellerInputsToSign, buyerInputsToSign, fee };
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

        // The taker edict
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
                // Rune change edict
                runestone.edicts.push(new Edict(runeId, BigInt(change), swapPsbt.txOutputs.length - 1));
            }
        }

        if (+protocolFee > 0) {
            swapPsbt.addOutput({
                address: PROTOCOL_FEE_OUTPUT,
                value: 546
            });
            // Protocol fee edict
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

    async getAvailableRuneInfo(order: RuneOrder, runeInfo: RuneInfo, publicKey?: string) {
        const unspentOutputs = await this.runeService.getRunesUnspentOutputs(order.makerAddress, runeInfo.rune_id, publicKey);
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
