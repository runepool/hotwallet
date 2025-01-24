import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuneOrdersModule } from './rune-orders/rune-orders.module';
import { PendingTransactionsModule } from './pending-transactions/pending-transactions.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3' as any,
      database: 'exchange.db',
      entities: [__dirname + '/entities/**/*.{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: true, // Auto-create tables in dev; disable in production
    }),
    RuneOrdersModule,
    PendingTransactionsModule
  ],
  exports: [RuneOrdersModule, PendingTransactionsModule],
})
export class DatabaseModule { }

