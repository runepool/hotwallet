import { Module } from '@nestjs/common';
import { RuneOrdersService } from './rune-orders.service';
import { DatabaseModule } from '@app/database';
import { NostrModule } from '@app/nostr';

@Module({
  imports: [DatabaseModule, NostrModule],
  providers: [RuneOrdersService],
  exports: [RuneOrdersService]
})
export class RuneOrdersModule { }
