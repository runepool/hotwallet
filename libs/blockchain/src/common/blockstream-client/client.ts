import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Network } from 'bitcoinjs-lib';
import { lastValueFrom } from 'rxjs';
import { TraceMe } from 'src/tracing';
import { FeeEstimation, OutspendInfo, TxInfo, TxStatus, Utxo } from './types';

const tracer = trace.getTracer('blockstream-client');

@Injectable()
export class BlockstreamClient {
  network: Network;
  url = 'https://blockstream.info/api';

  constructor(
    private http: HttpService,
  ) { }

  @TraceMe(tracer, 'broadcast')
  async broadcast(txHex: string) {
    return await lastValueFrom(this.http.post<string>(`${this.url}/tx`, txHex, { responseType: 'text' })).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getTxInfo')
  public async getTxInfo(txid: string): Promise<TxInfo> {
    return lastValueFrom(this.http.get<TxInfo>(`${this.url}/tx/${txid}`)).then((res) => res.data);
  }

  @TraceMe(tracer, 'getTxStatus')
  public async getTxStatus(txid: string): Promise<TxStatus> {
    return lastValueFrom(this.http.get<TxStatus>(`${this.url}/tx/${txid}/status`)).then((res) => res.data);
  }

  @TraceMe(tracer, 'getTipHeight')
  public async getTipHeight() {
    return lastValueFrom(this.http.get<number>(`${this.url}/blocks/tip/height`)).then((res) => res.data);
  }

  @TraceMe(tracer, 'getTxHex')
  public async getTxHex(txid: string): Promise<string> {
    return lastValueFrom(this.http.get<string>(`${this.url}/tx/${txid}/hex`)).then((res) => res.data);
  }

  @TraceMe(tracer, 'getOutspend')
  public async getOutspend(output: string): Promise<OutspendInfo> {
    const [txid, index] = output.split(':');

    return lastValueFrom(this.http.get<OutspendInfo>(`${this.url}/tx/${txid}/outspend/${index}`)).then(
      (res) => res.data
    );
  }

  @TraceMe(tracer, 'getFeeRate')
  public async getFeeRate(): Promise<FeeEstimation> {
    return lastValueFrom(this.http.get<FeeEstimation>(`${this.url}/fee-estimates`)).then((res) => res.data);
  }

  @TraceMe(tracer, 'getUtxos')
  public async getUtxos(address: string): Promise<Utxo[]> {
    return await lastValueFrom(this.http.get<Utxo[]>(`${this.url}/address/${address}/utxo`)).then((res) => res.data);
  }
}
