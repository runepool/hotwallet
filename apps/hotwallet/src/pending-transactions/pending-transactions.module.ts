import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { PendingTransactionsService } from './pending-transactions.service';
import { BlockchainModule } from '@app/blockchain';
import { TransactionsDbModule } from '@app/database/transactions/pending-transactions.module';
import { AutoRebalanceConfigModule } from '@app/database/auto-rebalance/auto-rebalance.module';

@Module({
  imports: [DatabaseModule, BlockchainModule, TransactionsDbModule, AutoRebalanceConfigModule],
  providers: [PendingTransactionsService],
  exports: [PendingTransactionsService]
})
export class PendingTransactionsModule { }
