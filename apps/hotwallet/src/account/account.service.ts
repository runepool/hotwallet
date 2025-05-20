import { OrdClient } from '@app/blockchain/common/ord-client/client';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger } from '@nestjs/common';
import { OrdOutput } from '@app/blockchain/common/ord-client/types';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { Psbt } from 'bitcoinjs-lib';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';
import { Edict, none, RuneId, Runestone, some } from 'runelib';
import { RunesService } from '@app/blockchain/runes/runes.service';
import { appendUnspentOutputsAsNetworkFee } from '@app/blockchain/psbtUtils';
import { AutoSplitConfigService } from '@app/database/auto-split/auto-split.service';
import { TransactionType } from '@app/database/entities/transaction.entity';
import { TransactionStatus } from '@app/database/entities/transaction.entity';
import { randomUUID } from 'crypto';

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

type AutoSplitConfig = {
  assetName: string;
  enabled: boolean;
  maxCost: number;
  splitSize: number;
}

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  constructor(
    private readonly transactionsDbService: TransactionsDbService,
    private readonly runeService: RunesService,
    private readonly ordService: OrdClient,
    private readonly bitcoinService: BitcoinService,
    private readonly bitcoinWalletService: BitcoinWalletService,
    private readonly autoSplitConfigService: AutoSplitConfigService
  ) { }

  async isLoggedIn(): Promise<boolean> {
    try {
      // Check if the wallet service is initialized
      // This is a synchronous method, no need for await
      return this.bitcoinWalletService.isInitialized();
    } catch (error) {
      Logger.error('Error checking login status:', error);
      return false;
    }
  }

  /**
   * Logs the user out by resetting the wallet service
   * @returns Promise resolving to true if logout was successful
   */
  async logout(): Promise<boolean> {
    try {
      // Reset the wallet service to clear all sensitive data
      this.bitcoinWalletService.reset();
      Logger.log('User logged out successfully');
      return true;
    } catch (error) {
      Logger.error('Error during logout:', error);
      return false;
    }
  }

  async getWalletAddress(): Promise<string> {
    try {
      const address = await this.bitcoinWalletService.getAddress();
      if (!address) {
        throw new Error('No wallet address available');
      }
      return address;
    } catch (error) {
      Logger.error('Error getting wallet address:', error);
      throw error;
    }
  }

  async getBalance(): Promise<{ address: string; balance: number, token: string }[]> {
    const btcBalance = {
      address: '',
      balance: 0,
      token: "BTC",
      decimals: 8
    }
    let address;
    try {
      // Initialize the wallet with the password if provided
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

  private checkSufficientFunds(outputInfo: any[], assetName: string, splits: number, amountPerSplit: number): { sufficient: boolean; message: string } {
    try {
      // For BTC, check if there's enough BTC for the split and fees
      if (assetName === 'BTC') {
        const totalBtcAvailable = outputInfo.reduce((sum, output) => {
          if (!output.spent && Object.keys(output.runes).length === 0) {
            return sum + output.value;
          }
          return sum;
        }, 0);

        // Rough estimate: each split needs ~1000 sats for fees plus the amount
        const estimatedRequired = (splits * amountPerSplit) + (splits * 1000);

        if (totalBtcAvailable < estimatedRequired) {
          return {
            sufficient: false,
            message: `Insufficient BTC. Available: ${totalBtcAvailable} sats, Required: ~${estimatedRequired} sats (including fees)`
          };
        }
      } else {
        // For runes, check if there's enough of the specific rune
        const totalRuneAvailable = outputInfo.reduce((sum, output) => {
          if (!output.spent && output.runes[assetName]) {
            return sum + parseInt(output.runes[assetName]);
          }
          return sum;
        }, 0);

        const totalRequired = splits * amountPerSplit;

        if (totalRuneAvailable < totalRequired) {
          return {
            sufficient: false,
            message: `Insufficient ${assetName}. Available: ${totalRuneAvailable}, Required: ${totalRequired}`
          };
        }

        // Also check if there's enough BTC for fees
        const totalBtcAvailable = outputInfo.reduce((sum, output) => {
          if (!output.spent && Object.keys(output.runes).length === 0) {
            return sum + output.value;
          }
          return sum;
        }, 0);

        // Rough estimate for fees
        const estimatedFees = splits * 1000;

        if (totalBtcAvailable < estimatedFees) {
          return {
            sufficient: false,
            message: `Insufficient BTC for fees. Available: ${totalBtcAvailable} sats, Required for fees: ~${estimatedFees} sats`
          };
        }
      }

      return { sufficient: true, message: 'Sufficient funds' };
    } catch (error) {
      this.logger.error(`Error checking funds: ${error.message}`, error.stack);
      return { sufficient: false, message: `Error checking funds: ${error.message}` };
    }
  }

  async splitAsset(assetName: string, splits: number, amountPerSplit: number): Promise<{ txid?: string; error?: string }> {
    try {
      const address = await this.bitcoinWalletService.getAddress();
      if (!address) {
        return { error: 'No wallet address available' };
      }

      const utxos = await this.ordService.address(address);
      const outputInfo = await this.ordService.outputBatch(utxos.outputs);

      // Check if there are sufficient funds before proceeding
      const hasEnoughFunds = this.checkSufficientFunds(outputInfo, assetName, splits, amountPerSplit);
      if (!hasEnoughFunds.sufficient) {
        return { error: hasEnoughFunds.message };
      }

      const psbt = await this.createSplitPsbt(address, assetName, splits, amountPerSplit, outputInfo);
      let signedPsbt = await this.bitcoinWalletService.signPsbt(psbt, []);

      const tx = signedPsbt.finalizeAllInputs().extractTransaction();
      const txid = await this.bitcoinService.broadcast(tx.toHex());
      const tradeId = randomUUID();
      await this.transactionsDbService.save([{
        txid: txid,
        tradeId,
        type: TransactionType.SPLIT,
        status: TransactionStatus.PENDING,
        orders: '',
        amount: amountPerSplit.toString(),
        price: '0',
        rune: assetName,
        reservedUtxos: JSON.stringify([])
      }]);

      return { txid };
    } catch (error) {
      this.logger.error(`Error splitting asset: ${error.message}`, error.stack);

      // Handle specific error types
      if (error.message.includes('insufficient') || error.message.includes('enough funds')) {
        return { error: `Insufficient funds: ${error.message}` };
      }

      // Handle other common errors
      if (error.message.includes('fee') || error.message.includes('rate')) {
        return { error: `Fee issue: ${error.message}` };
      }

      return { error: `Failed to split asset: ${error.message}` };
    }
  }

  async setAutoSplitStrategy(config: AutoSplitConfig): Promise<void> {
    try {
      // Validate configuration
      if (config.maxCost <= 0) {
        throw new Error('Maximum cost must be greater than 0');
      }
      if (config.splitSize <= 0) {
        throw new Error('Split size must be greater than 0');
      }

      // Store the configuration
      await this.autoSplitConfigService.set(config);
      Logger.log(`Auto split strategy set for ${config.assetName}`);
    } catch (error) {
      Logger.error('Error setting auto split strategy:', error);
      throw error;
    }
  }

  async getAutoSplitStrategy(assetName: string): Promise<AutoSplitConfig | undefined> {
    const config = await this.autoSplitConfigService.get(assetName);
    return config || undefined;
  }

  async getAllAutoSplitStrategies(): Promise<AutoSplitConfig[]> {
    return this.autoSplitConfigService.getAll();
  }

  async removeAutoSplitStrategy(assetName: string): Promise<boolean> {
    return this.autoSplitConfigService.remove(assetName);
  }

}
