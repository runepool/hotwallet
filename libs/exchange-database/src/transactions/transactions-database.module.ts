import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { PendingTransactionsService } from 'apps/hotwallet/src/pending-transactions/pending-transactions.service';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [PendingTransactionsService],
  exports: [PendingTransactionsService],
})
export class TransactionDBModule { }
