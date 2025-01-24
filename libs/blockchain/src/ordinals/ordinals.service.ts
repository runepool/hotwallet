import { Injectable } from '@nestjs/common';
import { InscriptionProvider } from '../common/inscription-provider/provider';
import { OrdOutput } from '../common/ord-client/types';

@Injectable()
export class OrdinalsService {
  network: 'mainnet' | 'testnet' | 'regtest';
  constructor(
    private inscriptionInfo: InscriptionProvider
  ) {
    this.network = process.env["NETWORK"] as any;
  }

  private ordOutputHasInscription(output: OrdOutput) {
    if (!output) {
      return false
    }

    const inscriptions = output.inscriptions;
    if (inscriptions && inscriptions.length > 0) {
      return true;
    }

    const runes = output.runes;
    if (Object.keys(runes).length > 0) {
      return true;
    }
    return false;
  }

  async hasInscriptionAtLocation(output: string): Promise<boolean> {
    if (this.network === 'regtest') {
      return false;
    }

    const response = await this.inscriptionInfo.inscriptionOutput(output);

    return this.ordOutputHasInscription(response.data);
  }

  async outputsWithInscriptions(outputs: string[]) {
    // short circuit
    if (outputs.length === 0) {
      return []
    }

    return this.inscriptionInfo
      .inscriptionOutputBatch(outputs)
      .then((data) => data.data.filter(this.ordOutputHasInscription));
  }

  async checkForRareSats(utxo: string): Promise<boolean> {
    return false;
  }
}
