import { Module } from '@nestjs/common';
import { PendingTransactionsService } from './pending-transactions.service';

@Module({
  providers: [PendingTransactionsService],
  exports: [PendingTransactionsService]
})
export class PendingTransactionsModule { }
