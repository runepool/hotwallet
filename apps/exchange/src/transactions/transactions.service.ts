import { Injectable } from '@nestjs/common';
import { TransactionsDbService } from '@app/exchange-database/transactions/transactions-database.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/transaction.dto';
import { Transaction } from '@app/exchange-database/entities/transaction.entity';


@Injectable()
export class TransactionsService {
    constructor(
        private readonly transactionsDbService: TransactionsDbService,
    ) { }

    async create(createTransactionDto: CreateTransactionDto): Promise<Transaction> {
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

    async update(id: string, updateTransactionDto: UpdateTransactionDto): Promise<Transaction> {
        const transaction = await this.transactionsDbService.findById(id);
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        return this.transactionsDbService.update(id, updateTransactionDto);
    }

    async remove(id: string): Promise<void> {
        await this.transactionsDbService.delete(id);
    }
}
