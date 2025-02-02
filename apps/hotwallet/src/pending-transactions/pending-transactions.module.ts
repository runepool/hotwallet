import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { PendingTransactionsService } from './pending-transactions.service';
import { BlockchainModule } from '@app/blockchain';

@Module({
  imports: [DatabaseModule, BlockchainModule],
  providers: [PendingTransactionsService],
  exports: [PendingTransactionsService]
})
export class PendingTransactionsModule { }
