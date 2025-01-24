import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { OrdinalsModule } from './ordinals/ordinals.module';
import { RunesModule } from './runes/runes.module';
import { BitcoinService } from './bitcoin/bitcoin.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [OrdinalsModule, RunesModule, HttpModule],
  providers: [BlockchainService, BitcoinService],
  exports: [BlockchainService, BitcoinService],
})
export class BlockchainModule { }
