import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import {
  FeeEstimation,
  OrdContent,
  OrdOutput,
  OutspendInfo,
  Sandshrew,
  TxInfo,
  TxStatus,
  Utxo
} from './types';
import { lastValueFrom } from 'rxjs';

export class SandshrewError extends Error {
  constructor(message: string) {
    super(`SandshrewError: ${message}`);
  }
}

@Injectable()
export class SandshrewClient {
  network: 'mainnet' | 'testnet' | 'regtest';
  constructor(
    private http: HttpService,
  ) {
    this.network = process.env["NETWORK"] as any;
  }

  // TODO: span
  private async call<T>(
    method: string,
    params: any,
    resultErrCheck?: (data: any) => void
  ): Promise<T> {
    const endpoint = `https://${this.network}.sandshrew.io/v1/${process.env['SANDSHREW_API_KEY']}`;
    const data = await lastValueFrom(
      this.http.post<Sandshrew<T>>(endpoint, {
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      })
    );

    // check for errors
    if (resultErrCheck) {
      resultErrCheck(data.data.result);
    }

    if (data.data.error) {
      throw new SandshrewError(JSON.stringify(data.data.error));
    }

    return data.data.result;
  }

  /**
   * Sandshrew has an awkward way of dealing with errors. It'll return a 200 OK but
   * with an unexpected string type in the result.
   */
  private noStringsCheck(data: unknown) {
    if (typeof data === 'string') {
      throw new SandshrewError(data);
    }
  }

  private errorStringCheck(errorStrings: string[]) {
    return function (data: unknown) {
      if (typeof data !== 'string') {
        return;
      }

      const found = errorStrings.find((search) => data.includes(search));

      if (found) {
        throw new SandshrewError(found);
      }
    };
  }

  async ordBlockheight(): Promise<number> {
    return await this.call<number>('ord_blockheight', []);
  }

  async ordOutput(output: string): Promise<OrdOutput> {
    return await this.call<OrdOutput>('ord_output', [output]);
  }

  /**
   * Returns the content of an ordinal inscription in base64 format
   * @param output
   * @returns
   */
  async ordContent(inscriptionId: string): Promise<OrdContent> {
    return await this.call<OrdContent>('ord_content', [inscriptionId]).then((data) => {
      const decoded = Buffer.from(data.result, 'base64').toString('utf-8');
      data.result = decoded;
      return data;
    });
  }

  // this endpoint does actually work but sandshrew have told us directly
  // (2024-07-08) that runes are unsupported until they roll out their
  // metashrew offering.
  // async ordRune(name: string): Promise<RuneInfo> {
  //   return this.call<RuneInfo>('ord_rune', [name]);
  // }

  // waiting for ordinals/ord to relase this feature. currently just on the
  // master branch.
  // async ordAddress(address: string): Promise<any> {
  //   return this.call<any>('ord_address', address)
  // }

  async esploraTx(txid: string): Promise<TxInfo> {
    return await this.call<TxInfo>('esplora_tx', [txid], this.noStringsCheck);
  }

  async esploraTxStatus(txid: string): Promise<TxStatus> {
    return await this.call<TxStatus>('esplora_tx::status', [txid], this.noStringsCheck);
  }

  async esploraTxHex(txid: string): Promise<string> {
    return await this.call<string>(
      'esplora_tx::hex',
      [txid],
      this.errorStringCheck(['Transaction not found', 'Invalid hex string'])
    );
  }

  async esploraTxOutspend(txid: string, index: number): Promise<OutspendInfo> {
    return await this.call<OutspendInfo>(
      'esplora_tx::outspend',
      [txid, index],
      this.noStringsCheck
    );
  }

  async esploraFeeEstimates(): Promise<FeeEstimation> {
    return await this.call<FeeEstimation>(
      'esplora_fee-estimates',
      [],
      this.noStringsCheck
    );
  }

  async esploraAddressUtxo(address: string): Promise<Utxo[]> {
    return await this.call<Utxo[]>(
      'esplora_address::utxo',
      [address],
      this.noStringsCheck
    );
  }

  async esploraTipHeight(): Promise<number> {
    return await this.call<number>('esplora_blocks:tip:height', [], this.noStringsCheck);
  }

  async btcSendrawtransaction(txhex: string): Promise<string> {
    return await this.call<string>('btc_sendrawtransaction', [txhex]);
  }
}
