import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell'
}

export enum OrderType {
    MARKET = 'market',
    LIMIT = 'limit'
}

export class CreateTradeDto {
    @ApiProperty({
        enum: OrderSide,
        description: 'The side of the trade (buy/sell)',
        example: OrderSide.BUY
    })
    @IsString()
    @IsEnum(OrderSide)
    side: OrderSide;

    @ApiProperty({
        description: 'The rune identifier',
        example: 'PEPE'
    })
    @IsString()
    rune: string;

    @ApiProperty({
        description: 'The quantity to trade in smallest units (sats for BTC, base units for runes)',
        example: '100000'
    })
    @IsString()
    quantity: string;

    @ApiProperty({
        description: 'Maximum allowed slippage in basis points (e.g., 100 for 1%)',
        example: '100',
        default: '100'
    })
    @IsString()
    @IsOptional()
    slippage?: string;

    @ApiProperty({
        description: 'Bitcoin payment address',
        example: 'bc1q...'
    })
    @IsString()
    takerPaymentAddress: string;

    @ApiProperty({
        description: 'Bitcoin public key',
        example: '02...'
    })
    @IsString()
    takerPaymentPublicKey: string;

    @ApiProperty({
        description: 'Rune address',
        example: 'rune1...'
    })
    @IsString()
    takerRuneAddress: string;

    @ApiProperty({
        description: 'Rune public key',
        example: '02...'
    })
    @IsString()
    takerRunePublicKey: string;
}