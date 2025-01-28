import { BlockchainService } from '@app/blockchain';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { SignableInput, UnspentOutput } from '@app/blockchain/bitcoin/types/UnspentOutput';
import { appendUnspentOutputsAsNetworkFee } from '@app/blockchain/psbtUtils';
import { RunesService } from '@app/blockchain/runes/runes.service';

import { OrderStatus, RuneOrder, RuneOrderType } from '@app/database/entities/rune-order';

import { Transaction as Trade, TransactionStatus } from '@app/database/entities/transactions';
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

export const PUB_EVENT = 69420;
export const SUB_EVENT = 69421;
export const DM = 4;

@Injectable()
export class RuneEngineService implements OnModuleInit {
    private readonly logger = new Logger(RuneEngineService.name);

    constructor(
        private readonly orderService: RuneOrdersService,
        private readonly bitcoinService: BitcoinService,
        private readonly walletService: BitcoinWalletService,
        private readonly runeService: RunesService,
        private readonly transactionsDbService: TransactionsDbService,
        private readonly blockchainService: BlockchainService,
        private readonly nostrService: NostrService
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
            return fillRequest.side === 'buy' 
                ? this.handleBuy(fillRequest)
                : this.handleSell(fillRequest);
        } catch (error) {
            this.logger.error(`Error processing fill request: ${error}`);
            throw error;
        }
    }

    private async processOrders(
        orders: RuneOrder[],
        amount: bigint,
        runeInfo: any,
        isBuyOrder: boolean
    ): Promise<{ selectedOrders: { order: RuneOrder, usedAmount: bigint }[], remainingAmount: bigint, totalAmount: bigint }> {
        let remainingAmount = amount;
        let totalAmount = 0n;
        const selectedOrders: { order: RuneOrder, usedAmount: bigint }[] = [];

        for (const order of orders) {
            const availableAmount = order.quantity - order.filledQuantity;
            const availableAmountInSats = this.calculateSatsAmount(availableAmount, order.price, runeInfo.decimals, isBuyOrder);

            if (availableAmountInSats >= remainingAmount) {
                const processedAmount = this.processFullFill(order, remainingAmount, runeInfo.decimals, isBuyOrder);
                if (processedAmount === 0n) break;
                
                totalAmount += processedAmount;
                selectedOrders.push({ order, usedAmount: processedAmount });
                remainingAmount = 0n;
                break;
            }

            const { updatedOrder, processedAmount } = this.processPartialFill(
                order, 
                availableAmount, 
                availableAmountInSats,
                isBuyOrder
            );
            
            remainingAmount -= BigInt(Math.ceil(availableAmountInSats));
            totalAmount += processedAmount;
            selectedOrders.push({ order: updatedOrder, usedAmount: availableAmount });
        }

        return { selectedOrders, remainingAmount, totalAmount };
    }

    private calculateSatsAmount(
        amount: bigint,
        price: bigint,
        decimals: number,
        isBuyOrder: boolean
    ): number {
        return isBuyOrder
            ? Number(amount * price) / 10 ** decimals
            : Number(amount * BigInt(price)) / 10 ** decimals;
    }

    private processFullFill(
        order: RuneOrder,
        remainingAmount: bigint,
        decimals: number,
        isBuyOrder: boolean
    ): bigint {
        if (isBuyOrder) {
            const runeAmount = BigInt(Math.ceil(Number(remainingAmount) / Number(order.price)) * 10 ** decimals);
            order.filledQuantity = BigInt(order.filledQuantity);
            order.filledQuantity += runeAmount;
            return runeAmount;
        } else {
            const quoteAmount = Math.floor(Number(remainingAmount) * Number(order.price)) / 10 ** decimals;
            if (quoteAmount < 1) return 0n;
            
            order.filledQuantity += remainingAmount;
            return BigInt(quoteAmount);
        }
    }

    private processPartialFill(
        order: RuneOrder,
        availableAmount: bigint,
        availableAmountInSats: number,
        isBuyOrder: boolean
    ): { updatedOrder: RuneOrder, processedAmount: bigint } {
        order.filledQuantity += availableAmount;
        order.status = OrderStatus.CLOSED;
        
        const processedAmount = isBuyOrder
            ? BigInt(availableAmount)
            : BigInt(availableAmountInSats);

        return { updatedOrder: order, processedAmount };
    }

    private async prepareSwapTransaction(
        runeInfo: any,
        req: RuneFillRequest,
        selectedOutputs: UnspentOutput[],
        hasRuneChange: boolean,
        runeAmount: bigint,
        isBuyOrder: boolean
    ): Promise<{ psbt: Psbt, sellerInputsToSign: SignableInput[], buyerInputsToSign: SignableInput[], fee: number }> {
        const runeId = new RuneId(+runeInfo.rune_id.split(":")[0], +runeInfo.rune_id.split(":")[1]);
        const receiverOutpoint = hasRuneChange ? 2 : 1;
        const edict = new Edict(runeId, isBuyOrder ? runeAmount : req.amount, receiverOutpoint);
        const runestone = new Runestone([edict], none(), none(), none());
        const swapPsbt = new Psbt({ network: this.walletService.network });

        const sellerInputsToSign: SignableInput[] = [];
        selectedOutputs.forEach((output, index) => {
            swapPsbt.addInput(output.toInput());
            sellerInputsToSign.push({ 
                index, 
                signerAddress: output.address, 
                singerPublicKey: output.publicKey, 
                location: output.location 
            });
        });

        await this.addSwapOutputs(swapPsbt, runestone, req, hasRuneChange, isBuyOrder);
        const { buyerInputsToSign, fee } = await this.addFundingOutputs(swapPsbt, req, isBuyOrder);

        return { psbt: swapPsbt, sellerInputsToSign, buyerInputsToSign, fee };
    }

    private async addSwapOutputs(
        swapPsbt: Psbt,
        runestone: Runestone,
        req: RuneFillRequest,
        hasRuneChange: boolean,
        isBuyOrder: boolean
    ): Promise<void> {
        // Add runestone output
        swapPsbt.addOutput({
            script: runestone.encipher(),
            value: 0
        });

        // Add change output if needed
        if (hasRuneChange) {
            swapPsbt.addOutput({
                address: isBuyOrder ? await this.walletService.getAddress() : req.takerRuneAddress,
                value: 546
            });
        }

        // Add rune receiver output
        swapPsbt.addOutput({
            address: isBuyOrder ? req.takerRuneAddress : await this.walletService.getAddress(),
            value: 546
        });

        // Add payment output
        swapPsbt.addOutput({
            address: isBuyOrder 
                ? await this.walletService.getAddress()
                : req.takerPaymentAddress,
            value: isBuyOrder ? Number(req.amount) : Number(req.amount)
        });
    }

    private async addFundingOutputs(
        swapPsbt: Psbt,
        req: RuneFillRequest,
        isBuyOrder: boolean
    ): Promise<{ buyerInputsToSign: SignableInput[], fee: number }> {
        const fundingAddress = isBuyOrder 
            ? req.takerPaymentAddress 
            : await this.walletService.getAddress();
            
        const fundingPublicKey = isBuyOrder
            ? req.takerPaymentPublicKey
            : await this.walletService.getPublicKey();

        const fundingOutputs = await this.blockchainService.getValidFundingInputs(
            fundingAddress,
            fundingPublicKey
        );

        const feeRate = await this.bitcoinService.getFeeRate();
        const buyerInputsToSign: SignableInput[] = [];
        
        const { fee } = appendUnspentOutputsAsNetworkFee(
            swapPsbt,
            fundingOutputs,
            [],
            fundingAddress,
            feeRate,
            buyerInputsToSign
        );

        return { buyerInputsToSign, fee };
    }

    async handleBuy(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);
        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.spaced_rune_name, OrderStatus.OPEN, RuneOrderType.ASK);
        // Remaining sats to fill
        const { selectedOrders, remainingAmount, totalAmount } = await this.processOrders(orders, BigInt(req.amount), runeInfo, true);

        if (remainingAmount > 0) {
            throw "Insufficient funds to fill this order"
        }

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
        const { hasRuneChange } = await this.selectRuneOutputs(runeOutputs, runeInfo.rune_id, req.amount, selectedOutputs);

        const { psbt, sellerInputsToSign, buyerInputsToSign, fee } = await this.prepareSwapTransaction(runeInfo, req, selectedOutputs, hasRuneChange, totalAmount, true);

        // Prepare psbt
        const pendingTxId = await this.createPendingTransaction(selectedOrders, req, totalAmount);

        Logger.log(`Offer: Rune${totalAmount} | Sats: ${req.amount} ${pendingTxId}`);
        return {
            fee,
            psbtBase64: psbt.toBase64(),
            takerInputsToSign: buyerInputsToSign,
            provider: await this.walletService.getPublicKey(),
            id: pendingTxId
        }
    }

    async handleSell(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);
        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.spaced_rune_name, OrderStatus.OPEN, RuneOrderType.BID);
        // Remaining sats to fill
        const { selectedOrders, remainingAmount, totalAmount } = await this.processOrders(orders, BigInt(req.amount), runeInfo, false);

        if (totalAmount < 546) {
            throw "Dust"
        }

        if (remainingAmount > 0) {
            throw "Insufficient funds to fill this order"
        }

        // Get the collateral unspent outputs
        const runeOutputs = await this.runeService.getRunesUnspentOutputs(req.takerRuneAddress, runeInfo.rune_id, req.takerRunePublicKey);
        if (!runeOutputs || runeOutputs.length === 0) {
            throw new OracleError(Errors.NO_RUNE_OUTPUTS_AVAILABLE);
        }

        const selectedOutputs: UnspentOutput[] = [];
        const { hasRuneChange } = await this.selectRuneOutputs(runeOutputs, runeInfo.rune_id, req.amount, selectedOutputs);

        const { psbt, sellerInputsToSign, buyerInputsToSign, fee } = await this.prepareSwapTransaction(runeInfo, req, selectedOutputs, hasRuneChange, BigInt(req.amount), false);

        // Prepare psbt
        const pendingTxId = await this.createPendingTransaction(selectedOrders, req, BigInt(req.amount));

        Logger.log(`Offer: Rune${req.amount} | Sats: ${totalAmount}`);
        return {
            fee,
            psbtBase64: psbt.toBase64(),
            takerInputsToSign: sellerInputsToSign,
            provider: await this.walletService.getPublicKey(),
            id: pendingTxId
        }
    }

    async selectRuneOutputs(runeOutputs: UnspentOutput[], runeId: string, runeAmount: bigint, usedOutputs: UnspentOutput[]) {
        let hasRuneChange = false;
        let totalRuneAmount: bigint = 0n;

        for (const runeOutput of runeOutputs) {
            if (!runeOutput.runeIds?.length) continue;

            const runeIdIndex = runeOutput.runeIds.findIndex(item => item === runeId);
            if (runeIdIndex === -1) continue;

            totalRuneAmount += runeOutput.runeBalances[runeIdIndex];
            usedOutputs.push(runeOutput);

            hasRuneChange = runeOutput.runeIds.length > 1 || totalRuneAmount > BigInt(runeAmount);

            if (totalRuneAmount >= BigInt(runeAmount)) break;
        }

        if (totalRuneAmount < BigInt(runeAmount)) {
            throw new OracleError(Errors.INSUFFICIENT_RUNE_AMOUNT);
        }

        return { hasRuneChange, totalRuneAmount };
    }

    private async createPendingTransaction(
        selectedOrders: { order: RuneOrder, usedAmount: bigint }[],
        req: RuneFillRequest,
        amount: bigint
    ): Promise<string> {
        const priceSum = selectedOrders.reduce((prev, curr) => prev += curr.order.price, 0n);
        const avgPrice = Number(priceSum) / selectedOrders.length;

        const pendingTx = new Trade();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}`).join(",");
        pendingTx.amount = amount.toString();
        pendingTx.price = avgPrice.toString();
        pendingTx.confirmations = 0;
        pendingTx.rune = req.rune;
        pendingTx.status = TransactionStatus.PENDING;

        const { id } = await this.transactionsDbService.create(pendingTx);
        return id;
    }
}
