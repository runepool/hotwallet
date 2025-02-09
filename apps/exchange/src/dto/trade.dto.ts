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
        example: 'btc_usdt'
    })
    @IsString()
    rune: string;

    @ApiProperty({
        description: 'The quantity of the trade',
        example: 1000000
    })
    @IsNumber()
    quantity: number;

    @ApiProperty({
        description: 'The taker payment address',
        example: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    })
    @IsString()
    takerPaymentAddress: string;

    @ApiProperty({
        description: 'The taker payment public key',
        example: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
    })
    @IsString()
    takerPaymentPublicKey: string;

    @ApiProperty({
        description: 'The taker rune address',
        example: 'rune1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    })
    @IsString()
    takerRuneAddress: string;

    @ApiProperty({
        description: 'The taker rune public key',
        example: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
    })
    @IsString()
    takerRunePublicKey: string;
}