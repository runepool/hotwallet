import { TransactionsDbModule } from '@app/database/transactions/pending-transactions.module';
import { EngineModule } from '@app/engine';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountController } from './account/account.controller';
import { AccountModule } from './account/account.module';
import { PendingTransactionController } from './pending-transactions/pending-transactions.controller';
import { PendingTransactionsModule } from './pending-transactions/pending-transactions.module';
import { RuneOrdersController } from './rune-orders/rune-orders.controller';
import { RuneOrdersModule } from "./rune-orders/rune-orders.module";
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    RuneOrdersModule,
    AccountModule,
    EngineModule,
    PendingTransactionsModule,
    TransactionsDbModule
  ],
  controllers: [RuneOrdersController, AccountController, PendingTransactionController],
  providers: [],
})
export class AppModule { }
