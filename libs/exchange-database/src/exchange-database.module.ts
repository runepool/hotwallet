import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { RuneOrdersDatabaseModule } from './rune-orders/rune-orders-database.module';
import { TransactionDBModule } from './transactions/transactions-database.module';

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
    TransactionDBModule,
  ],
  exports: [
    RuneOrdersDatabaseModule,
    TransactionDBModule,
  ]
})
export class ExchangeDatabaseModule { }
