import { ExchangeDatabaseModule } from '@app/exchange-database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RuneOrdersModule } from './rune-orders/rune-orders.module';
import { EngineModule } from '@app/engine';
import { config } from 'dotenv';

import { ExchangeController } from './exchange.controller';
import { QuoteModule } from './quote/quote.module';
import { QuoteController } from './quote/quote.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { TransactionsModule } from './transactions/transactions.module';

config({ path: './._env' });
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ExchangeDatabaseModule,
    RuneOrdersModule,
    QuoteModule,
    EngineModule,
    TransactionsModule
  ],
  controllers: [ExchangeController, QuoteController],
})
export class ExchangeModule { }
