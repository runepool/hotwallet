import { Module } from '@nestjs/common';
import { RuneOrdersService } from './rune-orders.service';
import { DatabaseModule } from '@app/database';
import { NostrModule } from '@app/nostr';
import { RunesModule } from '@app/blockchain/runes/runes.module';
import { ClientsModule } from '../clients/clients.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule, 
    NostrModule, 
    RunesModule, 
    ClientsModule,
    ConfigModule.forRoot()
  ],
  providers: [RuneOrdersService],
  exports: [RuneOrdersService]
})
export class RuneOrdersModule { }
