import { Injectable } from '@nestjs/common';
import { BitcoinService } from '../bitcoin/bitcoin.service';
import { Psbt } from 'bitcoinjs-lib';
import { UnspentOutput } from '../bitcoin/types/UnspentOutput';
import { InscriptionProvider } from '../common/inscription-provider/provider';
import { RuneInfo, RuneOutput } from '../common/inscription-provider/types';
import { RuneID } from './types';


@Injectable()
export class RunesService {
  network: 'mainnet' | 'testnet' | 'regtest';
  apiKey: string;
  url: string;

  constructor(
    private bitcoinService: BitcoinService,
    private inscriptionInfo: InscriptionProvider
  ) {
  }

  async getTotalRuneBalanceOfPsbt(psbt: Psbt, runeId: string): Promise<bigint> {
    let totalAmount = 0n;

    const outputs = psbt.clone().txInputs.map((item) => `${item.hash.reverse().toString("hex")}:${item.index}`)
    const outputInfos = await this.inscriptionInfo.runeOutputBatch(outputs);
    for (const runeInfo of outputInfos.data) {
      const runeIndex = runeInfo.rune_ids.findIndex(item => item === runeId);
      if (runeIndex === -1) {
        continue
      }
      totalAmount += BigInt(runeInfo.balances[runeIndex])
    }

    return totalAmount;
  }

  async getRunesUnspentOutputs(address: string, runeId: string, publicKey?: string): Promise<UnspentOutput[]> {
    const walletInfo = await this.inscriptionInfo.addressOutputs(address);

    return Promise.all(
      walletInfo.data
        .map(async (info) => {
          if (info.rune_ids.includes(runeId)) {
            const output = await this.bitcoinService.getUnspentOutput(info.output, publicKey);
            if (output.safe) {
              output.runeIds = info.rune_ids;
              output.runeBalances = info.balances.map(item => BigInt(item))
              return output;
            }
          }
        })).then(data =>
          data.filter(Boolean).sort((a, b) => {
            const runeIdIndexA = a.runeIds.findIndex(item => item === runeId);
            const runeIdIndexB = b.runeIds.findIndex(item => item === runeId);
            return Number(b.runeBalances[runeIdIndexB] - a.runeBalances[runeIdIndexA]);
          }));
  }

  private runeOutputHasRune(output: RuneOutput) {
    if (output.rune_ids && output.rune_ids.length > 0) {
      return true;
    }

    return false
  }

  async outputHasRune(output: string) {
    return this.inscriptionInfo.runeOutput(output).
      then(async (data) => {
        if (!data || !data.data) {
          return false
        }
        return this.runeOutputHasRune(data.data)
      });
  }

  async outputsWithRunes(outputs: string[]) {
    // short circuit
    if (outputs.length === 0) {
      return []
    }

    return this.inscriptionInfo.runeOutputBatch(outputs)
      .then(data =>
        data.data.filter(this.runeOutputHasRune)
      )
  }

  /**
   * Returns all rune ids found in the given output set
   * @param outputs 
   * @returns 
   */
  async detectRunesOnOutputs(outputs: string[]): Promise<RuneID[]> {
    // short circuit
    if (outputs.length === 0) {
      return []
    }

    return this.inscriptionInfo.runeOutputBatch(outputs).then(data => {
      const result = {};
      data.data.forEach(item => item.rune_ids.forEach(runeId => {
        result[runeId] = true
      }))

      return Object.keys(result);
    })
  }

  /**
   * Get rune amounts of a given output
   * @param output 
   * @returns 
   */
  async getRunesOfOutput(output: string) {
    const data = await this.inscriptionInfo.runeOutput(output)
    if (!data || !data.data) {
      return null
    }

    return {
      runeIds: data.data.rune_ids,
      runeBalances: data.data.balances.map(item => BigInt(item))
    }
  }

  async getRuneInfo(runeId: string): Promise<RuneInfo> {
    return this.inscriptionInfo.tickerInfo(runeId)
  }
}
