import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuneOrdersModule } from './rune-orders/rune-orders.module';
import { TransactionsDbModule } from './transactions/pending-transactions.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3' as any,
      database: process.env.DATABASE_NAME || 'exchange.db',
      entities: [__dirname + '/entities/**/*.{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: true, // Auto-create tables in dev; disable in production
    }),
    RuneOrdersModule,
    TransactionsDbModule
  ],
  exports: [RuneOrdersModule, TransactionsDbModule],
})
export class DatabaseModule { }
