import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingTransactionsService } from './pending-transactions.service';
import { PendingTransaction } from '../entities/pending-transaction';

@Module({
  imports: [TypeOrmModule.forFeature([PendingTransaction])],
  providers: [PendingTransactionsService],
  exports: [PendingTransactionsService],
})
export class PendingTransactionsModule { }
