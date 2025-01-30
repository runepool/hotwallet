import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Network, Psbt, networks } from 'bitcoinjs-lib';
import { lastValueFrom } from 'rxjs';
import { AddressType } from './types/Address';
import { CpfpInfo, OutspendInfo, TxInfo, TxStatus } from './types/Tx';
import { Utxo } from './types/Utxo';
import { Transaction } from "bitcoinjs-lib";
import { isAxiosError } from 'axios';
import { Errors, OracleError } from 'libs/errors/errors';
import { UnspentOutput } from './types/UnspentOutput';
import { decodeScriptToAddress } from './utils';

export class SpentOutputError extends Error {
  constructor(output: string) {
    super(`output ${output} spent`);
  }
}

export class InvalidSequenceError extends Error { }

@Injectable()
export class BitcoinService {
  network: Network;
  url =
    process.env.BITCOIN_NETWORK !== 'mainnet'
      ? `https://mempool.space/${process.env.BITCOIN_NETWORK}/api`
      : `https://mempool.space/api`;

  constructor(private http: HttpService) {
    this.network = networks[process.env['BITCOIN_NETWORK']]
  }

  public async broadcast(txHex: string) {
    try {
      return await lastValueFrom(this.http.post<string>(`${this.url}/tx`, txHex, { responseType: 'text' })).then(
        (res) => res.data
      );
    } catch (error: unknown) {
      Logger.error(`Error broadcasting ${txHex}`)
      if (isAxiosError(error)) {
        throw new OracleError(Errors.MEMPOOL_ERROR(`${error.response.data}`));
      }
      throw error;
    }
  }

  public async getTx(txid: string): Promise<Transaction> {
    return this.getTxHex(txid).then(data => Transaction.fromHex(data))
  }

  public async getTxInfo(txid: string): Promise<TxInfo> {
    return lastValueFrom(this.http.get<TxInfo>(`${this.url}/tx/${txid}`)).then((res) => res.data);
  }

  public async getTxStatus(txid: string): Promise<TxStatus> {
    return lastValueFrom(this.http.get<TxStatus>(`${this.url}/tx/${txid}/status`)).then((res) => res.data);
  }

  public async getTipHeight() {
    return lastValueFrom(this.http.get<number>(`${this.url}/blocks/tip/height`)).then((res) => res.data);
  }

  public async getCpfpInfo(txid: string): Promise<CpfpInfo> {
    return lastValueFrom(this.http.get<CpfpInfo>(`${this.url}/v1/cpfp/${txid}`)).then((res) => res.data);
  }

  public async getTxHex(txid: string): Promise<string> {
    return lastValueFrom(this.http.get<string>(`${this.url}/tx/${txid}/hex`)).then((res) => res.data);
  }

  public async getOutspend(output: string): Promise<OutspendInfo> {
    const [txid, index] = output.split(':');
    return lastValueFrom(this.http.get<OutspendInfo>(`${this.url}/tx/${txid}/outspend/${index}`)).then(
      (res) => res.data
    );
  }

  public async getFeeRate(): Promise<number> {
    const result: any = await lastValueFrom(this.http.get(`${this.url}/v1/fees/recommended`));
    return result.data.fastestFee;
  }

  public async getUnspentOutput(utxo: string, publicKey?: string, address?: string): Promise<UnspentOutput> {
    const [txid, location] = utxo.split(':');
    const [tx, outspend, txStatus] = await Promise.all([
      this.getTx(txid),
      this.getOutspend(utxo),
      this.getTxStatus(txid)
    ]);
    const vout = tx.outs.find((_, index) => index === +location);
    return Object.assign(new UnspentOutput(), {
      amount: vout.value,
      scriptPubKey: vout.script.toString('hex'),
      txid,
      vout: +location,
      tx: tx.toHex(),
      address: decodeScriptToAddress(vout.script, this.network),
      signerAddress: !!address ? address : decodeScriptToAddress(vout.script, this.network),
      publicKey,
      safe: txStatus.confirmed && !outspend.spent,
      network: this.network
    } as UnspentOutput);
  }

  public async getUtxos(address: string): Promise<Utxo[]> {
    return lastValueFrom(this.http.get<Utxo[]>(`${this.url}/address/${address}/utxo`)).then((res) => res.data);
  }

  public getAddressType(address: string): AddressType {
    const typePrefix = address?.slice(0, 4) || 'unknown';
    if (typePrefix === 'unknown') {
      return AddressType.UNKNOWN;
    }

    if (typeof typePrefix[0] == 'number') {
      return AddressType.NORMAL;
    }

    if (typePrefix.endsWith('c1p')) {
      return AddressType.TAPROOT;
    }

    if (typePrefix.endsWith('c1q')) {
      return AddressType.SEGWIT;
    }

    return AddressType.UNKNOWN;
  }

  public async validateInput(output: string) {
    const out = await this.getOutspend(output);
    if (out.spent) {
      throw new SpentOutputError(output)
    }
  }

  public async validatePsbt(psbt: Psbt) {
    return Promise.all(
      psbt.txInputs.map(async (input) => {
        if (input.sequence < 0xffffffff) {
          throw new InvalidSequenceError('Invalid input sequence');
        }
        await this.validateInput(`${input.hash.reverse().toString('hex')}:${input.index}`);
      })
    );
  }
}
