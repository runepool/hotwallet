import { ExchangeDatabaseModule } from '@app/exchange-database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RuneOrdersModule } from './rune-orders/rune-orders.module';
import { EngineModule } from '@app/engine';
import { config } from 'dotenv';

config({ path: './._env' });
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ExchangeDatabaseModule,
    RuneOrdersModule,
    EngineModule
  ],
})
export class ExchangeModule { }
