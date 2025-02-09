import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransactionsDbModule } from './transactions/pending-transactions.module';
import { AutoSplitConfigModule } from './auto-split/auto-split.module';
import { RuneOrdersDatabaseModule } from './rune-orders/rune-orders-database.module';
import { RuneOrder } from './entities/rune-order.entity';
import { AutoSplitConfiguration } from './entities/auto-split-config.entity';
import { SettingsEntity } from './entities/settings.entity';
import { Transaction } from './entities/transaction.entity';

  /**
   * A NestJS module that sets up TypeORM and imports the necessary
   * database modules for the application.
   *
   * This module should be imported in the root application module.
   *
   * @module DatabaseModule
   */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3' as any,
      database: process.env.DATABASE_NAME || 'exchange.db',
      entities: [RuneOrder,AutoSplitConfiguration, SettingsEntity, Transaction],
      synchronize: true, // Auto-create tables in dev; disable in production
    }),
    AutoSplitConfigModule,
    RuneOrdersDatabaseModule,
    TransactionsDbModule,
  ],
  exports: [RuneOrdersDatabaseModule, TransactionsDbModule, AutoSplitConfigModule],
})
export class DatabaseModule { }
