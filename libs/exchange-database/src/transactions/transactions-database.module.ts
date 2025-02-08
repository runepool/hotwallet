import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { Transaction } from '../entities/transaction.entity';
import { TransactionsDbService } from './transactions-database.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [TransactionsDbService],
  exports: [TransactionsDbService],
})
export class TransactionDBModule { }
