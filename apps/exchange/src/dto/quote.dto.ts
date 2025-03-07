import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SelectedOrder } from '@app/engine/types';

export enum QuoteType {
  BUY = 'buy',
  SELL = 'sell'
}

export class GetQuoteDto {
  @ApiProperty({ description: 'Token to swap from', example: 'BTC' })
  @IsString()
  from: string;

  @ApiProperty({ description: 'Token to swap to', example: 'PEPE' })
  @IsString()
  to: string;

  @ApiProperty({ description: 'Amount of from token', example: '100000' })
  @IsString()
  amount: string;
}

export class QuoteResponseDto {
  @ApiProperty({ description: 'Token being swapped from', example: 'BTC' })
  from: string;

  @ApiProperty({ description: 'Token being swapped to', example: 'PEPE' })
  to: string;

  @ApiProperty({ description: 'Amount of from token', example: '100000' })
  fromAmount: string;

  @ApiProperty({ description: 'Amount of to token', example: '1000000' })
  toAmount: string;

  @ApiProperty({ description: 'Price of to token in from token', example: '10' })
  price: string;

  @ApiProperty({ description: 'Whether there is enough liquidity for this trade', example: true })
  hasLiquidity: boolean;

  @ApiProperty({ description: 'The orders that would be used for this trade' })
  orders: SelectedOrder[];
}


