import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RuneOrdersDatabaseModule } from './rune-orders/rune-orders-database.module';
import { TransactionsDbModule } from '@app/database/transactions/pending-transactions.module';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
      inject: [ConfigService],
    }),
    RuneOrdersDatabaseModule,
    TransactionsDbModule,
  ],
  providers: [],
  exports: [TypeOrmModule]
})
export class ExchangeDatabaseModule { }
