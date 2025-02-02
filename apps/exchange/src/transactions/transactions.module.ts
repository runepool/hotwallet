import { Module } from '@nestjs/common';
import { TransactionsDbModule } from '@app/exchange-database/transactions/transactions-database.module';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
    imports: [TransactionsDbModule],
    controllers: [TransactionsController],
    providers: [TransactionsService],
    exports: [TransactionsService],
})
export class TransactionsModule { }
