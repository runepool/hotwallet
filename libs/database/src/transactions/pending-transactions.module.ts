import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransactionsDbService as TransactionsDbService } from './transactions.service';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [TransactionsDbService],
  exports: [TransactionsDbService],
})
export class TransactionsDbModule { }
