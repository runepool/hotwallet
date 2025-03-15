import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { ExchangeDatabaseModule } from '@app/exchange-database';
import { BlockchainModule } from '@app/blockchain';

@Module({
  imports: [
    ExchangeDatabaseModule,
    BlockchainModule,
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule { }
