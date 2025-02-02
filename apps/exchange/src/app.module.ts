import { ExchangeDatabaseModule } from '@app/exchange-database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RuneOrdersModule } from './rune-orders/rune-orders.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TradingModule } from './trading/trading.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ExchangeDatabaseModule,
    RuneOrdersModule,
    TransactionsModule,
    TradingModule,
  ],
})
export class AppModule { }
