import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransactionsDbModule } from './transactions/pending-transactions.module';
import { AutoSplitConfigModule } from './auto-split/auto-split.module';
import { RuneOrdersDatabaseModule } from './rune-orders/rune-orders-database.module';

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
      entities: [__dirname + '/entities/**/*.{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: true, // Auto-create tables in dev; disable in production
    }),
    AutoSplitConfigModule,
    RuneOrdersDatabaseModule,
    TransactionsDbModule,
  ],
  exports: [RuneOrdersDatabaseModule, TransactionsDbModule, AutoSplitConfigModule],
})
export class DatabaseModule { }
