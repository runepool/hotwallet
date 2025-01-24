import { Module } from '@nestjs/common';
import { RuneEngineService } from './rune-engine.service';
import { DatabaseModule } from '@app/database';
import { WalletModule } from '@app/wallet';
import { BlockchainModule } from '@app/blockchain';
import { RunesModule } from '@app/blockchain/runes/runes.module';
import { NostrModule } from '@app/nostr';


@Module({
  imports: [DatabaseModule, WalletModule, BlockchainModule, RunesModule, NostrModule],
  providers: [RuneEngineService],
  exports: [RuneEngineService],
})
export class EngineModule { }
