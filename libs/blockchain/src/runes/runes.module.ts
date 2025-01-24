import { Module } from '@nestjs/common';
import { BitcoinService } from '../bitcoin/bitcoin.service';
import { InscriptionInfoProviderModule } from '../common/inscription-provider/inscription-provider.module';
import { RunesService } from './runes.service';
import { HttpModule } from '@nestjs/axios';


@Module({
  imports: [InscriptionInfoProviderModule, HttpModule],
  providers: [RunesService, BitcoinService],
  exports: [RunesService]
})
export class RunesModule { }
