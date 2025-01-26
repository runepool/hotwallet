import { Transaction } from '@app/database/entities/transactions';
import { TransactionsDbService } from '@app/database/transactions/transactions.service';
import {
    Controller,
    Delete,
    Get,
    HttpCode,
    NotFoundException,
    Param,
} from '@nestjs/common';

@Controller('transactions')
export class PendingTransactionController {
    constructor(
        private readonly service: TransactionsDbService
    ) { }

    // Fetch all pending transactions
    @Get()
    async fetchAll(): Promise<Transaction[]> {
        return this.service.findConfirming();
    }

    // Fetch a single transaction by ID
    @Get(':id')
    async fetchById(@Param('id') id: string): Promise<Transaction> {
        const transaction = await this.service.findById(id);
        if (!transaction) {
            throw new NotFoundException(`PendingTransaction with ID ${id} not found`);
        }
        return transaction;
    }

    // Delete a transaction by ID
    @Delete(':id')
    @HttpCode(204)
    async deleteById(@Param('id') id: string): Promise<void> {
        await this.service.delete(id);

    }
}
