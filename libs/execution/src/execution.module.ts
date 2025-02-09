import { Module } from '@nestjs/common';
import { EventHandlerService } from './event-handler/event-handler.service';
import { ExecutionService } from './execution.service';
import { BlockchainModule } from '@app/blockchain';
import { RunesModule } from '@app/blockchain/runes/runes.module';
import { WalletModule } from '@app/wallet';
import { ExchangeDatabaseModule } from '@app/exchange-database';
import { NostrModule } from '@app/nostr';

@Module({
  imports: [
    BlockchainModule,
    RunesModule,
    WalletModule,
    ExchangeDatabaseModule,
    NostrModule,
  ],
  providers: [ExecutionService, EventHandlerService],
  exports: [ExecutionService, EventHandlerService],
})
export class ExecutionModule {}
