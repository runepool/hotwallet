import { Module } from '@nestjs/common';
import { RuneOrdersModule } from '../rune-orders/rune-orders.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';

@Module({
    imports: [
        RuneOrdersModule,
        TransactionsModule,
    ],
    controllers: [TradingController],
    providers: [TradingService],
    exports: [TradingService],
})
export class TradingModule { }
