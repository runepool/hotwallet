import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transactions';

@Injectable()
export class TransactionsDbService {
    constructor(
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
    ) { }

    async create(transaction: Partial<Transaction>): Promise<Transaction> {
        const newTransaction = this.transactionRepository.create(transaction);
        return await this.transactionRepository.save(newTransaction);
    }

    async save(transactions: Partial<Transaction>[]): Promise<Transaction[]> {
        return this.transactionRepository.save(transactions);
    }

    async findAll(): Promise<Transaction[]> {
        return await this.transactionRepository.find();
    }

    async findById(id: string): Promise<Transaction | null> {
        return await this.transactionRepository.findOneBy({ id });
    }

    async findByTxid(id: string): Promise<Transaction | null> {
        return await this.transactionRepository.findOneBy({ id });
    }


    async delete(id: string): Promise<void> {
        await this.transactionRepository.delete({
            id
        });
    }

    async deleteBatch(ids: string[]): Promise<void> {
        await this.transactionRepository.delete(ids);
    }

    /**
     * Fetch all transactions with status 'pending' or 'confirming' using query builder.
     */
    async findPendingAndConfirming(): Promise<Transaction[]> {
        return await this.transactionRepository
            .createQueryBuilder('transaction')
            .where('transaction.status = :pending', { pending: 'pending' })
            .orWhere('transaction.status = :confirming', { confirming: 'confirming' })
            .getMany();
    }


    /**
     * Fetch all transactions that landed in the mempool.
     */
    async findMempoolTransactions(): Promise<Transaction[]> {
        return await this.transactionRepository
            .createQueryBuilder('transaction')
            .orWhere('transaction.status = :confirming', { confirming: 'confirming' })
            .orWhere('transaction.status = :confirmed', { confirmed: 'confirmed' })
            // .orWhere('transaction.type  = :split', { split: 'split' })
            .getMany();
    }
}
