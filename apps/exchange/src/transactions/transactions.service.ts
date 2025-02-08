import { Transaction } from '@app/exchange-database/entities/transaction.entity';
import { TransactionsDbService } from '@app/exchange-database/transactions/transactions-database.service';
import { Injectable } from '@nestjs/common';


@Injectable()
export class TransactionsService {
    constructor(
        private readonly transactionsDbService: TransactionsDbService,
    ) { }

    async create(createTransactionDto: Partial<Transaction>): Promise<Transaction> {
        return this.transactionsDbService.create(createTransactionDto);
    }

    async findAll(): Promise<Transaction[]> {
        return this.transactionsDbService.findAll();
    }

    async findOne(id: string): Promise<Transaction> {
        return this.transactionsDbService.findById(id);
    }

    async findByTxid(txid: string): Promise<Transaction> {
        return this.transactionsDbService.findByTxid(txid);
    }

    async remove(id: string): Promise<void> {
        await this.transactionsDbService.delete(id);
    }
}
