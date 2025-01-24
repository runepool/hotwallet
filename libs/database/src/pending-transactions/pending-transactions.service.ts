import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingTransaction } from '../entities/pending-transaction';

@Injectable()
export class PendingTransactionsService {
    constructor(
        @InjectRepository(PendingTransaction)
        private readonly pendingTransactionRepository: Repository<PendingTransaction>,
    ) { }

    async create(transaction: Partial<PendingTransaction>): Promise<PendingTransaction> {
        const newTransaction = this.pendingTransactionRepository.create(transaction);
        return await this.pendingTransactionRepository.save(newTransaction);
    }

    async findAll(): Promise<PendingTransaction[]> {
        return await this.pendingTransactionRepository.find();
    }

    async findById(id: string): Promise<PendingTransaction | null> {
        return await this.pendingTransactionRepository.findOneBy({ id });
    }

    async delete(id: string): Promise<void> {
        await this.pendingTransactionRepository.delete(id);
    }
}
