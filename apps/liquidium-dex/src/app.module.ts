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
import { SettingsController } from './settings/settings.controller';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    RuneOrdersModule,
    AccountModule,
    EngineModule,
    PendingTransactionsModule,
    TransactionsDbModule,
    SettingsModule
  ],
  controllers: [RuneOrdersController, AccountController, PendingTransactionController, SettingsController],
  providers: [],
})
export class AppModule { }
