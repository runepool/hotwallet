import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingTransactionsService } from './pending-transactions.service';
import { Transaction } from '../entities/transactions';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [PendingTransactionsService],
  exports: [PendingTransactionsService],
})
export class PendingTransactionsModule { }
