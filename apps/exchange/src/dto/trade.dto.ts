import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export enum OrderSide {
    BUY = 'buy',
    SELL = 'sell'
}

export enum OrderType {
    MARKET = 'market',
    LIMIT = 'limit'
}

export class CreateTradeDto {
    @IsString()
    @IsEnum(OrderSide)
    side: OrderSide;

    @IsString()
    rune: string;

    @IsNumber()
    quantity: number;

    @IsString()
    takerPaymentAddress: string;

    @IsString()
    takerPaymentPublicKey: string;

    @IsString()
    takerRuneAddress: string;

    @IsString()
    takerRunePublicKey: string;
}