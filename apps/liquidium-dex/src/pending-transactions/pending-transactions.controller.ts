import {
    Controller,
    Get,
    Delete,
    Param,
    NotFoundException,
    HttpCode,
  } from '@nestjs/common';
  import { Repository } from 'typeorm';
  import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '@app/database/entities/transactions';
  
  @Controller('pending-transactions')
  export class PendingTransactionController {
    constructor(
      @InjectRepository(Transaction)
      private readonly pendingTransactionRepository: Repository<Transaction>,
    ) {}
  
    // Fetch all pending transactions
    @Get()
    async fetchAll(): Promise<Transaction[]> {
      return this.pendingTransactionRepository.find();
    }
  
    // Fetch a single transaction by ID
    @Get(':id')
    async fetchById(@Param('id') id: string): Promise<Transaction> {
      const transaction = await this.pendingTransactionRepository.findOneBy({ id });
      if (!transaction) {
        throw new NotFoundException(`PendingTransaction with ID ${id} not found`);
      }
      return transaction;
    }
  
    // Delete a transaction by ID
    @Delete(':id')
    @HttpCode(204)
    async deleteById(@Param('id') id: string): Promise<void> {
      const result = await this.pendingTransactionRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException(`PendingTransaction with ID ${id} not found`);
      }
    }
  }
  