import { OrdClient } from '@app/blockchain/common/ord-client/client';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger } from '@nestjs/common';
import { OrdOutput } from '@app/blockchain/common/ord-client/types';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { Psbt } from 'bitcoinjs-lib';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';
import { TransactionStatus, TransactionType } from '@app/database/entities/transactions';
import { Edict, none, RuneId, Runestone, some } from 'runelib';
import { RunesService } from '@app/blockchain/runes/runes.service';
import { appendUnspentOutputsAsNetworkFee } from '@app/blockchain/psbtUtils';

type OutputHealth = {
  location: string;
  value?: number;
  script_pubkey?: string;
  address?: string;
  transaction?: string;
  sat_ranges?: number[][];
  inscriptions?: string[];
  runes?: Record<string, { amount: number }>;
  amount?: number;
};

type OutputsHealth = {
  [key: string]: OutputHealth[];
};

@Injectable()
export class AccountService {
  constructor(
    private readonly transactionsDbService: TransactionsDbService,
    private readonly runeService: RunesService,
    private readonly ordService: OrdClient,
    private readonly bitcoinService: BitcoinService,
    private readonly bitcoinWalletService: BitcoinWalletService) { }

  async getBalance(): Promise<{ address: string; balance: number, token: string }[]> {
    const btcBalance = {
      address: '',
      balance: 0,
      token: "BTC",
      decimals: 8
    }
    let address;
    try {
      address = await this.bitcoinWalletService.getAddress();
      if (!address) {
        return [btcBalance];
      }

      const utxos = await this.ordService.address(address);
      btcBalance.address = address;
      btcBalance.balance = utxos.satBalance / 1e8;
      const runeBalances = {}
      utxos.runeBalances.forEach(runeBalance => {
        runeBalances[runeBalance.name] = {
          address,
          balance: runeBalance.amount,
          token: runeBalance.name,
        }
      });

      const result = [btcBalance];
      result.push(...Object.values(runeBalances) as any);
      return result;
    }
    catch (error) {
      Logger.error(error);
      return [btcBalance];
    }
  }

  async getLiquidityHealth(): Promise<OutputsHealth> {
    try {
      const address = await this.bitcoinWalletService.getAddress();
      if (!address) {
        throw new Error('No wallet address available');
      }

      const utxos = await this.ordService.address(address);

      const outputInfo = await this.ordService.outputBatch(utxos.outputs);

      const outputsHealth: OutputsHealth = outputInfo.reduce((acc, output, index) => {
        if (Object.keys(output.runes).length === 0) {
          if (!acc['BTC']) {
            acc['BTC'] = [];
          }
          acc['BTC'].push({
            location: utxos.outputs[index],
            ...output
          });
          return acc;
        }

        Object.entries(output.runes).forEach(([token, amount]) => {
          if (!acc[token]) {
            acc[token] = [];
          }
          acc[token].push({
            location: utxos.outputs[index],
            ...output
          });
        });

        return acc;
      }, {} as OutputsHealth);
      return outputsHealth;
    } catch (error) {
      Logger.error('Error getting liquidity health:', error);
    }
  }

  private async createSplitPsbt(
    address: string,
    assetName: string,
    splits: number,
    amountPerSplit: number,
    outputInfo: OrdOutput[]
  ): Promise<Psbt> {
    const btcOutputs = outputInfo.filter(output => {
      return Object.keys(output.runes).length == 0 && output.inscriptions.length == 0;
    });

    const feeRate = await this.bitcoinService.getFeeRate();
    const psbt = new Psbt({ network: this.bitcoinService.network });

    if (assetName !== 'BTC') {
      const assetOutputs = outputInfo.filter(output => {
        return Object.entries(output.runes).some(([token, amount]) => {
          return token === assetName && !output.spent
        })
      });

      if (assetOutputs.length === 0) {
        throw new Error(`No available outputs found containing enough ${assetName}`);
      }

      if (assetOutputs.length >= splits) {
        throw new Error(`Cannot split ${assetName} into more than ${splits} outputs`);
      }

      const unspentOutputs = await Promise.all(
        assetOutputs.map(async output => this.bitcoinService.getUnspentOutput(output.outpoint, await this.bitcoinWalletService.getPublicKey(), await this.bitcoinWalletService.getAddress()))
      );

      unspentOutputs.forEach(output => {
        psbt.addInput(output.toInput());
      });

      const totalAmount = assetOutputs.reduce((acc, output) => acc + output.runes[assetName].amount, 0);
      if (totalAmount < amountPerSplit) {
        throw new Error(`Not enough ${assetName} available to split`);
      }

      Array(splits).fill(0).forEach(() => {
        psbt.addOutput({
          address: address,
          value: 546
        });
      })

      const runeInfo = await this.runeService.getRuneInfo(assetName);
      const runeId = new RuneId(+runeInfo.rune_id.split(':')[0], +runeInfo.rune_id.split(':')[1]);
      const edict = new Edict(runeId, BigInt(amountPerSplit), psbt.txOutputs.length + 2);
      const runestone = new Runestone([edict], none(), none(), some(0));

      psbt.addOutput({
        script: runestone.encipher(),
        value: 0
      });

    } else {
      if (btcOutputs.length === 0) {
        throw new Error(`No available outputs found containing enough ${assetName}`);
      }

      if (btcOutputs.length >= splits) {
        throw new Error(`Cannot split ${assetName} into more than ${splits} outputs`);
      }

      const totalAmount = btcOutputs.reduce((acc, output) => acc + output.value, 0);
      if (totalAmount < amountPerSplit) {
        throw new Error(`Not enough ${assetName} available to split`);
      }

      const estimatedFee = (140 * btcOutputs.length + 40 * (splits + 1)) * (feeRate + 2);
      let left = totalAmount - estimatedFee;
      const perSplit = +(totalAmount / splits).toFixed(0);
      while (left > 0) {
        if (left < amountPerSplit) {
          if (left === 10_000) {
            throw new Error(`Sats value cannot be lower than 10_000`);
          }
          psbt.addOutput({
            address: address,
            value: left
          })
          break;
        }

        if (perSplit === 10_000) {
          throw new Error(`Sats value cannot be lower than 10_000`);
        }

        psbt.addOutput({
          address: address,
          value: perSplit
        });

        left -= perSplit;
      }
    }

    const unspentOutputs = await Promise.all(
      btcOutputs.map(async output => this.bitcoinService.getUnspentOutput(output.outpoint, await this.bitcoinWalletService.getPublicKey(), await this.bitcoinWalletService.getAddress()))
    );


    appendUnspentOutputsAsNetworkFee(psbt, unspentOutputs, [], address, feeRate + 2, []);

    return psbt;
  }

  async splitAsset(assetName: string, splits: number, amountPerSplit: number): Promise<string> {
    try {
      const address = await this.bitcoinWalletService.getAddress();
      if (!address) {
        throw new Error('No wallet address available');
      }

      const utxos = await this.ordService.address(address);
      const outputInfo = await this.ordService.outputBatch(utxos.outputs);

      const psbt = await this.createSplitPsbt(address, assetName, splits, amountPerSplit, outputInfo);
      const unspentOutputs = outputInfo.filter(output => {
        if (assetName === 'BTC') {
          return Object.keys(output.runes).length == 0;
        }
        return Object.entries(output.runes).some(([token]) => token === assetName && !output.spent);
      });

      let signedPsbt = this.bitcoinWalletService.signPsbt(psbt, []);

      const tx = signedPsbt.finalizeAllInputs().extractTransaction();
      const txid = await this.bitcoinService.broadcast(tx.toHex());
      await this.transactionsDbService.save([{
        txid: txid,
        type: TransactionType.SPLIT,
        status: TransactionStatus.PENDING,
        orders: '',
        amount: amountPerSplit.toString(),
        price: '0',
        rune: assetName
      }]);

      return txid;
    } catch (error) {
      Logger.error('Error splitting asset:', error);
      throw error;
    }
  }
}
