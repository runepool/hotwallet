import { BlockchainService } from '@app/blockchain';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { SignableInput, UnspentOutput } from '@app/blockchain/bitcoin/types/UnspentOutput';
import { appendUnspentOutputsAsNetworkFee } from '@app/blockchain/psbtUtils';
import { RunesService } from '@app/blockchain/runes/runes.service';
import { PendingTransaction } from '@app/database/entities/pending-transaction';
import { OrderStatus, RuneOrder } from '@app/database/entities/rune-order';
import { PendingTransactionsService } from '@app/database/pending-transactions/pending-transactions.service';
import { RuneOrdersService } from '@app/database/rune-orders/rune-orders.service';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Psbt } from 'bitcoinjs-lib';
import { Errors, OracleError } from 'libs/errors/errors';
import { Edict, none, RuneId, Runestone } from 'runelib';
import { FillRuneOrderOffer, RuneFillRequest } from './types';
import { NostrService } from '@app/nostr';
import { Event } from 'nostr-tools';

export const PUB_EVENT = 69420;
export const SUB_EVENT = 69421;

@Injectable()
export class RuneEngineService implements OnModuleInit {
    constructor(
        private readonly orderService: RuneOrdersService,
        private readonly bitcoinService: BitcoinService,
        private readonly walletService: BitcoinWalletService,
        private readonly runeService: RunesService,
        private readonly pendingTransactionService: PendingTransactionsService,
        private readonly blockchainService: BlockchainService,
        private readonly nostrService: NostrService
    ) { }

    onModuleInit() {
        this.nostrService.subscribeToEvents(SUB_EVENT, async (event: Event) => {
            try {
                const fillOrderRequest = Object.assign(new RuneFillRequest(), JSON.parse(Buffer.from(event.content, 'base64').toString('utf-8')));
                const result = await this.process(fillOrderRequest);
                this.nostrService.publishDirectMessage(JSON.stringify(result), event.pubkey);
            } catch (error) {
                console.log("Error", error);
                Logger.error("Could not decode nostr event")
            }
        })
    }

    async process(fillRequest: RuneFillRequest): Promise<FillRuneOrderOffer> {
        try {

            const handler = fillRequest.side === 'buy' ? this.handleBuy : this.handleSell;
            const fillOffer = await handler(fillRequest);
            return fillOffer;
        } catch (error) {
            Logger.log(`Error ${error}`)
        }
    }

    async handleBuy(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        // Get rune info
        const runeInfo = await this.runeService.getRuneInfo(req.rune);
        // Check to see if we have any available orders
        const orders = await this.orderService.getOrders(runeInfo.rune_name, OrderStatus.OPEN);
        let remainingFillAmount = req.runeAmount;
        let order: RuneOrder;
        const selectedOrders: { order: RuneOrder, usedAmount: bigint }[] = [];

        while (order = orders.shift()) {
            const availableOrderAmount = order.quantity - order.filledQuantity;
            if (availableOrderAmount >= remainingFillAmount) {
                order.filledQuantity += remainingFillAmount;
                selectedOrders.push({ order, usedAmount: remainingFillAmount });
                remainingFillAmount = 0n;
                break;
            }

            remainingFillAmount -= availableOrderAmount;
            order.filledQuantity += availableOrderAmount;
            selectedOrders.push({ order, usedAmount: availableOrderAmount });
        }

        if (remainingFillAmount > 0) {
            throw "Insufficient funds to fill this order"
        }
        // Prepare psbt
        const priceSum = selectedOrders.reduce((prev, curr) => prev += curr.order.price, 0n);
        const avgPrice = Number(priceSum) / selectedOrders.length;
        const totalPrice = Math.ceil(avgPrice * Number(req.runeAmount));

        const runeId = new RuneId(+runeInfo.rune_id.split(":")[0], +runeInfo.rune_id.split(":")[1]);

        // Get the collateral unspent outputs
        const runeOutputs = await this.runeService.getRunesUnspentOutputs(this.walletService.address, req.rune, this.walletService.publicKey);
        if (!runeOutputs || runeOutputs.length === 0) {
            throw new OracleError(Errors.NO_RUNE_OUTPUTS_AVAILABLE);
        }

        const selectedOutputs: UnspentOutput[] = [];
        const { hasRuneChange } = await this.selectRuneOutputs(runeOutputs, runeInfo.rune_id, req.runeAmount, selectedOutputs);

        const receiverOutpoint = hasRuneChange ? 2 : 1;
        const edict = new Edict(runeId, req.runeAmount, receiverOutpoint);
        const runestone = new Runestone([edict], none(), none(), none());
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
                address: this.walletService.address,
                value: 546
            });
        };

        swapPsbt.addOutput({
            address: req.takerAddress,
            value: 546
        });

        swapPsbt.addOutput({
            address: this.walletService.address,
            value: totalPrice
        });

        // Get funding unspent outputs
        const fundingOutputs = await this.blockchainService.getValidFundingInputs(req.takerAddress, req.takePublicKey);
        const feeRate = await this.bitcoinService.getFeeRate();
        const buyerInputsToSign: SignableInput[] = [];
        appendUnspentOutputsAsNetworkFee(swapPsbt, fundingOutputs, [], req.takerAddress, feeRate, buyerInputsToSign);
        const psbt = this.walletService.signPsbt(swapPsbt, sellerInputsToSign.map(item => item.index));

        const pendingTx = new PendingTransaction();
        pendingTx.orders = selectedOrders.map(item => `${item.order.id}:${item.usedAmount}`).join(",");

        await this.pendingTransactionService.create(pendingTx);

        return {
            psbtBase64: psbt.toBase64(),
            takerInputsToSign: buyerInputsToSign
        }
    }


    async handleSell(req: RuneFillRequest): Promise<FillRuneOrderOffer> {
        throw "Not implemented";
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
}
