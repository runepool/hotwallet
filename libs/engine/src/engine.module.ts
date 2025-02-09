import { BlockchainModule } from '@app/blockchain';
import { RunesModule } from '@app/blockchain/runes/runes.module';
import { ExchangeDatabaseModule } from '@app/exchange-database';
import { NostrModule } from '@app/nostr';
import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { MakerGatewayService } from './maker-gateway/maker-gateway.service';
import { RuneEngineService } from './rune-engine.service';

@Module({
  imports: [WalletModule, BlockchainModule, RunesModule, NostrModule, ExchangeDatabaseModule],
  providers: [RuneEngineService, MakerGatewayService],
  exports: [RuneEngineService],
})
export class EngineModule { }
