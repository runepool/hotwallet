import { RunesModule } from '@app/blockchain/runes/runes.module';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from '../clients/clients.module';
import { RuneOrdersService } from './rune-orders.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    DatabaseModule, 
    RunesModule, 
    ClientsModule,
  ],
  providers: [RuneOrdersService],
  exports: [RuneOrdersService]
})
export class RuneOrdersModule { }
