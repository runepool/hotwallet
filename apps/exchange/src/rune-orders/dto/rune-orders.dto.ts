import { OrderStatus } from '@app/exchange-database/entities/rune-order.entity';
import { IsString, IsNumber, IsEnum } from 'class-validator';

export class CreateRuneOrderDto {
  @IsString()
  rune: string;

  @IsNumber()
  amount: bigint;

  @IsNumber()
  price: bigint;
}

export class UpdateRuneOrderDto {
  @IsNumber()
  amount?: bigint;

  @IsNumber()
  price?: bigint;

  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
