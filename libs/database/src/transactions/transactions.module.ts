import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transaction } from '../entities/transactions';
import { PendingTransactionsService } from 'apps/hotwallet/src/pending-transactions/pending-transactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [PendingTransactionsService],
  exports: [PendingTransactionsService],
})
export class PendingTransactionsModule { }
