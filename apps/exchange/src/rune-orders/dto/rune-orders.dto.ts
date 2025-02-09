import { OrderStatus, RuneOrderType } from '@app/exchange-database/entities/rune-order.entity';
import { IsString, IsNumber, IsEnum, IsUUID } from 'class-validator';

export class CreateRuneOrderDto {
  @IsUUID()
  uuid: string;

  @IsString()
  rune: string;

  @IsNumber()
  quantity: bigint;

  @IsNumber()
  price: bigint;

  @IsEnum(RuneOrderType)
  type: RuneOrderType;
}

export class UpdateRuneOrderDto {
  @IsUUID()
  uuid: string;
  
  @IsNumber()
  amount?: bigint;

  @IsNumber()
  price?: bigint;

  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
