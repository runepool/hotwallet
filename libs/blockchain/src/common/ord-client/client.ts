import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrdOutput, RuneInfo } from './types';
import { lastValueFrom } from 'rxjs';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';

@Injectable()
export class OrdClient implements OnModuleInit {
  private endpoint: string;

  constructor(
    private http: HttpService,
    private readonly settingsService: DatabaseSettingsService,
  ) {}

  async onModuleInit() {
    await this.updateEndpoint();
  }

  async updateEndpoint() {
    const settings = await this.settingsService.getSettings();
    this.endpoint = settings.ordUrl;
    if (!this.endpoint) {
      throw new Error('ORD URL not set in settings');
    }
  }

  async blockheight(): Promise<number> {
    const response = await lastValueFrom(
      this.http.get<number>(`${this.endpoint}/blockheight`, {
        headers: {
          Accept: 'application/json'
        }
      })
    );

    return response.data;
  }

  async output(output: string): Promise<OrdOutput> {
    return lastValueFrom(
      this.http.get<OrdOutput>(`${this.endpoint}/output/${output}`, {
        headers: {
          Accept: 'application/json'
        }
      })
    ).then((r) => r.data);
  }

  async outputBatch(outputs: string[]): Promise<OrdOutput[]> {
    return lastValueFrom(
      this.http.post<OrdOutput[]>(`${this.endpoint}/outputs`, outputs, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      })
    ).then((r) => r.data);
  }

  /**
   * see: https://github.com/ordinals/ord/blob/cc40344297df2d47f483742523dcef17cd5ed096/src/subcommand/server.rs#L673
   *
   * You can use whichever name you want to reference the rune
   * - spaced name
   * - unspaced name
   * - rune id
   * - rune number
   */
  async rune(name: string): Promise<RuneInfo> {
    return lastValueFrom(
      this.http.get<RuneInfo>(`${this.endpoint}/rune/${name}`, {
        headers: {
          Accept: 'application/json'
        }
      })
    ).then((r) => r.data);
  }

  /**
   * Returns an array of unspent outputs with inscriptions
   */
  async address(address: string): Promise<string[]> {
    return lastValueFrom(
      this.http.get<string[]>(`${this.endpoint}/address/${address}`, {
        headers: {
          Accept: 'application/json'
        }
      })
    ).then((r) => r.data);
  }

  /**
   * Returns the content for a given inscription
   */
  async inscriptionContent(inscriptionId: string): Promise<string> {
    return lastValueFrom(
      this.http.get<string>(`${this.endpoint}/content/${inscriptionId}`, {
        responseType: 'text'
      })
    ).then((r) => r.data);
  }
}
