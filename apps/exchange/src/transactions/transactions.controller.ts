import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/transaction.dto';
import { Transaction } from 'bitcoinjs-lib';


@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post()
    create(@Body() createTransactionDto: CreateTransactionDto): Promise<Transaction> {
        return this.transactionsService.create(createTransactionDto);
    }

    @Get()
    findAll(): Promise<Transaction[]> {
        return this.transactionsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string): Promise<Transaction> {
        return this.transactionsService.findOne(id);
    }

    @Get('txid/:txid')
    findByTxid(@Param('txid') txid: string): Promise<Transaction> {
        return this.transactionsService.findByTxid(txid);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateTransactionDto: UpdateTransactionDto,
    ): Promise<Transaction> {
        return this.transactionsService.update(id, updateTransactionDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): Promise<void> {
        return this.transactionsService.remove(id);
    }
}
