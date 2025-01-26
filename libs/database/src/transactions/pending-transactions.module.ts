import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transactions';
import { TransactionsDbService as TransactionsDbService } from './transactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [TransactionsDbService],
  exports: [TransactionsDbService],
})
export class TransactionsDbModule { }
