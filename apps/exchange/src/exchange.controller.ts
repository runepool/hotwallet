import { Controller, Get, Post, Body } from '@nestjs/common';
import { RuneEngineService } from '@app/engine';
import { RuneFillRequest } from '@app/engine/types';
import { CreateTradeDto, ExecuteTradeDto } from './dto/trade.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SwapTransaction } from '@app/execution/types';

@ApiTags('exchange')
@Controller('exchange')
export class ExchangeController {
  constructor(private readonly exchangeService: RuneEngineService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new trade' })
  @ApiResponse({ status: 201, description: 'The trade has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid trade parameters.' })
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

  @Post('submit')
  @ApiOperation({ summary: 'Submit a signed trade transaction' })
  @ApiResponse({ status: 201, description: 'The trade has been successfully submitted.' })
  @ApiResponse({ status: 400, description: 'Invalid submission parameters.' })
  async submitTrade(@Body() executeTradeDto: ExecuteTradeDto) {
    return this.exchangeService.finalize(executeTradeDto);
  }
}
