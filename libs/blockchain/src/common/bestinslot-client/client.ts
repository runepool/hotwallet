import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BestInSlotResponse, InscriptionBatchResponse, RuneInfo, PossiblyEmptyRuneOutput, RuneOutput, Brc20 } from './types';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class BestinslotClient {
  network: 'mainnet' | 'testnet' | 'regtest';
  apiKey: string;
  url: string;

  constructor(
    private http: HttpService,
    private config: ConfigService
  ) {
    this.network =
      this.config.getOrThrow('BITCOIN_NETWORK') === 'bitcoin' ? 'mainnet' : this.config.getOrThrow('BITCOIN_NETWORK');
    this.apiKey = this.config.get('BIS_API_KEY');

    if (this.config.getOrThrow('BITCOIN_NETWORK') === 'bitcoin') {
      this.url = `https://api.bestinslot.xyz/v3`;
    } else {
      this.url = `https://${this.network}.api.bestinslot.xyz/v3`;
    }
  }

  static outputHasRunes(data: PossiblyEmptyRuneOutput): data is RuneOutput {
    return (data as RuneOutput).pkscript !== undefined;
  }

  async runesWalletValidOutputs(address: string): Promise<BestInSlotResponse<RuneOutput[]>> {
    return lastValueFrom(
      this.http.get<BestInSlotResponse<RuneOutput[]>>(`${this.url}/runes/wallet_valid_outputs`, {
        params: {
          address,
          sort_by: 'output',
          order: 'desc',
          offset: 0,
          count: 2000
        },
        headers: {
          'x-api-key': this.apiKey
        }
      })
    ).then((r) => r.data);
  }

  async runesOutputInfo(output: string): Promise<BestInSlotResponse<PossiblyEmptyRuneOutput>> {
    return lastValueFrom(
      this.http.get<BestInSlotResponse<PossiblyEmptyRuneOutput>>(`${this.url}/runes/output_info`, {
        params: {
          output
        },
        headers: {
          'x-api-key': this.apiKey
        }
      })
    ).then((r) => r.data);
  }

  // max of 100
  // call batchRuneOutputsInfoPaged instead
  async batchRuneOutputsInfo(outputs: string[]) {
    if (outputs.length > 100) {
      console.warn(`trying to query bestinslot's rune batch endpoint with more than 100 records (${outputs.length})`)
    }

    const response = await lastValueFrom(
      this.http.post<BestInSlotResponse<PossiblyEmptyRuneOutput[]>>(
        `${this.url}/runes/batch_output_info`,
        { queries: outputs },
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      )
    );

    // TODO: sanity check for if we got all the outputs?

    return response.data;
  }

  async batchRuneOutputsInfoPaged(queries: string[]): Promise<BestInSlotResponse<PossiblyEmptyRuneOutput[]>> {
    const chunkSize = 100;

    let chunks = [];
    for (let i = 0; i < queries.length; i += chunkSize) {
      chunks.push(queries.slice(i, i + chunkSize));
    }

    const responses = await Promise.all(chunks.map((chunk) => this.batchRuneOutputsInfo(chunk)));

    const blockHeight = Math.min(...responses.map((r) => r.block_height));

    return {
      block_height: blockHeight,
      data: responses.map((r) => r.data).flat(1)
    };
  }

  // max length is 100
  // call batchInscriptionInfoPaged instead
  async batchInscriptionInfo(queries: string[]) {
    if (queries.length > 100) {
      console.warn(`trying to query bestinslot's inscription batch endpoint with more than 100 records (${queries.length})`)
    }

    return lastValueFrom(
      this.http.post<BestInSlotResponse<InscriptionBatchResponse[]>>(
        `${this.url}/inscription/batch_info`,
        { queries },
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      )
    ).then((data) => data.data);
  }

  async batchInscriptionInfoPaged(queries: string[]): Promise<BestInSlotResponse<InscriptionBatchResponse[]>> {
    const chunkSize = 100;

    let chunks = [];
    for (let i = 0; i < queries.length; i += chunkSize) {
      chunks.push(queries.slice(i, i + chunkSize));
    }

    const responses = await Promise.all(chunks.map((chunk) => this.batchInscriptionInfo(chunk)));

    const blockHeight = Math.min(...responses.map((r) => r.block_height));

    return {
      block_height: blockHeight,
      data: responses.map((r) => r.data).flat(1)
    };
  }

  async runesTickerInfo(runeId: string): Promise<BestInSlotResponse<RuneInfo>> {
    return lastValueFrom(
      this.http.get<BestInSlotResponse<RuneInfo>>(`${this.url}/runes/ticker_info`, {
        params: {
          rune_id: runeId
        },
        headers: {
          'x-api-key': this.apiKey
        }
      })
    ).then((data) => data.data);
  }

  async brc20ValidityCheck(inscriptionIds: string[]): Promise<BestInSlotResponse<Brc20.ValidityCheck[]>> {
    return lastValueFrom(
      this.http.post<BestInSlotResponse<Brc20.ValidityCheck[]>>(`${this.url}/brc20/batch_info`, {
        queries: inscriptionIds
      },
        {
          headers: {
            'x-api-key': this.apiKey
          }
        })
    ).then((data) => data.data);
  }

  async brc20TickerInfo(ticker: string): Promise<BestInSlotResponse<Brc20.TickerInfo>> {
    return lastValueFrom(
      this.http.get<BestInSlotResponse<Brc20.TickerInfo>>(`${this.url}/brc20/ticker_info`, {
        params: {
          ticker
        },
        headers: {
          'x-api-key': this.apiKey
        }
      })
    ).then((data) => data.data);
  }
}
