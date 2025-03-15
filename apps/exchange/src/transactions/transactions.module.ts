import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { ExchangeDatabaseModule } from '@app/exchange-database';
import { BlockchainModule } from '@app/blockchain';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ExchangeDatabaseModule,
    BlockchainModule,
    ScheduleModule.forRoot(),
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule { }
