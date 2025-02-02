import { Module } from '@nestjs/common';
import { RuneOrdersService } from './rune-orders.service';
import { DatabaseModule } from '@app/database';
import { NostrModule } from '@app/nostr';
import { RunesModule } from '@app/blockchain/runes/runes.module';

@Module({
  imports: [DatabaseModule, NostrModule, RunesModule],
  providers: [RuneOrdersService],
  exports: [RuneOrdersService]
})
export class RuneOrdersModule { }
