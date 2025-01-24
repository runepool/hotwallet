import { Module } from '@nestjs/common';
import { OrdClientModule } from '../ord-client/ord-client.module';
import { BestinslotClientModule } from '../bestinslot-client/bestinslot-client.module';
import { BestinslotInscriptionProvider, InscriptionProvider, OrdInscriptionProvider, SandshrewInscriptionProvider } from './provider';
import { SandshrewClientModule } from '../sandshrew-client/sandshrew-client.module';
import { BitcoinService } from '@app/blockchain/bitcoin/bitcoin.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [SandshrewClientModule, OrdClientModule, BestinslotClientModule, HttpModule],
  providers: [OrdInscriptionProvider, InscriptionProvider, BestinslotInscriptionProvider, SandshrewInscriptionProvider, BitcoinService],
  exports: [OrdInscriptionProvider, InscriptionProvider, BestinslotInscriptionProvider, SandshrewInscriptionProvider]
})
export class InscriptionInfoProviderModule { }
