import { TransactionsDbModule } from '@app/database/transactions/pending-transactions.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountController } from './account/account.controller';
import { AccountModule } from './account/account.module';
import { PendingTransactionController } from './pending-transactions/pending-transactions.controller';
import { PendingTransactionsModule } from './pending-transactions/pending-transactions.module';
import { RuneOrdersController } from './rune-orders/rune-orders.controller';
import { RuneOrdersModule } from "./rune-orders/rune-orders.module";
import { SettingsController } from './settings/settings.controller';
import { SettingsModule } from './settings/settings.module';
import { ClientsModule } from './clients/clients.module';
import { ExecutionModule } from '@app/execution';
import { RebalanceController } from './rebalance/rebalance.controller';
import { RebalanceModule } from './rebalance/rebalance.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'webapp', 'dist'),
      exclude: ['/api/*'],
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
    ScheduleModule.forRoot(),
    RuneOrdersModule,
    AccountModule,
    PendingTransactionsModule,
    TransactionsDbModule,
    SettingsModule,
    ClientsModule,
    ExecutionModule,
    RebalanceModule
  ],
  controllers: [RuneOrdersController, AccountController, PendingTransactionController, SettingsController, RebalanceController],
  providers: [],
})
export class HotWalletModule { }
