import { BlockchainModule } from '@app/blockchain';
import { RunesModule } from '@app/blockchain/runes/runes.module';
import { DatabaseModule } from '@app/database';
import { NostrModule } from '@app/nostr';
import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { EventHandlerService } from './event-handler/event-handler.service';
import { ExecutionService } from './execution.service';

@Module({
  imports: [
    BlockchainModule,
    RunesModule,
    WalletModule,
    DatabaseModule,
    NostrModule,
  ],
  providers: [ExecutionService, EventHandlerService],
  exports: [ExecutionService, EventHandlerService],
})
export class ExecutionModule {}
