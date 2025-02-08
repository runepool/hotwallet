import { Controller, Get, Post, Body } from '@nestjs/common';
import { RuneEngineService } from '@app/engine';
import { RuneFillRequest } from '@app/engine/types';
import { CreateTradeDto } from './dto/trade.dto';

@Controller('exchange')
export class ExchangeController {
  constructor(private readonly exchangeService: RuneEngineService) { }


  @Post()
  async createTrade(@Body() createTradeDto: CreateTradeDto) {
    return this.exchangeService.process({
      amount: BigInt(createTradeDto.quantity),
      rune: createTradeDto.rune,
      side: createTradeDto.side,
      takerPaymentAddress: createTradeDto.takerPaymentAddress,
      takerPaymentPublicKey: createTradeDto.takerPaymentPublicKey,
      takerRuneAddress: createTradeDto.takerRuneAddress,
      takerRunePublicKey: createTradeDto.takerRunePublicKey
    } as RuneFillRequest);
  }
}
