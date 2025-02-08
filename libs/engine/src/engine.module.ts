import { Module } from '@nestjs/common';
import { RuneEngineService } from './rune-engine.service';
import { DatabaseModule } from '@app/database';
import { WalletModule } from '@app/wallet';
import { BlockchainModule } from '@app/blockchain';
import { RunesModule } from '@app/blockchain/runes/runes.module';
import { NostrModule } from '@app/nostr';
import { MakerGatewayService } from './maker-gateway/maker-gateway.service';
import { ExchangeDatabaseModule } from '@app/exchange-database';

@Module({
  imports: [WalletModule, BlockchainModule, RunesModule, NostrModule, ExchangeDatabaseModule],
  providers: [RuneEngineService, MakerGatewayService],
  exports: [RuneEngineService],
})
export class EngineModule { }
