import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { TraceMe } from 'src/tracing';
import { trace } from '@opentelemetry/api';
import { Network } from 'bitcoinjs-lib';
import { CpfpInfo, FeeRates, OutspendInfo, TxInfo, TxStatus } from './types';
import { Utxo } from './types';

const tracer = trace.getTracer('mempool-client');

@Injectable()
export class MempoolClient {
  network: Network;
  url =
    process.env.BITCOIN_NETWORK !== 'bitcoin'
      ? `https://liquidium.mempool.space/${process.env.BITCOIN_NETWORK}/api`
      : `https://liquidium.mempool.space/api`;

  constructor(
    private http: HttpService,
    private config: ConfigService
  ) {}

  @TraceMe(tracer, 'broadcast')
  public async broadcast(txHex: string): Promise<string> {
    return await lastValueFrom(
      this.http.post<string>(`${this.url}/tx`, txHex, { responseType: 'text' })
    ).then((res) => res.data);
  }

  @TraceMe(tracer, 'getTxInfo')
  public async getTxInfo(txid: string): Promise<TxInfo> {
    return lastValueFrom(this.http.get<TxInfo>(`${this.url}/tx/${txid}`)).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getTxStatus')
  public async getTxStatus(txid: string): Promise<TxStatus> {
    return lastValueFrom(this.http.get<TxStatus>(`${this.url}/tx/${txid}/status`)).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getTipHeight')
  public async getTipHeight() {
    return lastValueFrom(this.http.get<number>(`${this.url}/blocks/tip/height`)).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getCpfpInfo')
  public async getCpfpInfo(txid: string): Promise<CpfpInfo> {
    return lastValueFrom(this.http.get<CpfpInfo>(`${this.url}/v1/cpfp/${txid}`)).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getTxHex')
  public async getTxHex(txid: string): Promise<string> {
    return lastValueFrom(this.http.get<string>(`${this.url}/tx/${txid}/hex`)).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getOutspend')
  public async getOutspend(output: string): Promise<OutspendInfo> {
    const [txid, index] = output.split(':');

    return lastValueFrom(
      this.http.get<OutspendInfo>(`${this.url}/tx/${txid}/outspend/${index}`)
    ).then((res) => res.data);
  }

  @TraceMe(tracer, 'getFeeRate')
  public async getFeeRate(): Promise<FeeRates> {
    return lastValueFrom(this.http.get<FeeRates>(`${this.url}/v1/fees/recommended`)).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getUtxos')
  public async getUtxos(address: string): Promise<Utxo[]> {
    return await lastValueFrom(
      this.http.get<Utxo[]>(`${this.url}/address/${address}/utxo`)
    ).then((res) => res.data);
  }
}
