import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { TradingService } from './trading.service';
import { CreateTradeDto } from './dto/trade.dto';

@Controller('trading')
export class TradingController {
    constructor(private readonly tradingService: TradingService) { }

    @Post()
    async createTrade(@Body() createTradeDto: CreateTradeDto) {
        return this.tradingService.createTrade(createTradeDto);
    }

}
