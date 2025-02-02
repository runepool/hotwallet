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
    @IsEnum(OrderType)
    type: OrderType;

    @IsString()
    baseAsset: string;

    @IsString()
    quoteAsset: string;

    @IsNumber()
    quantity: number;

}