import { OrderStatus, RuneOrderType } from '@app/exchange-database/entities/rune-order.entity';
import { IsString, IsNumber, IsEnum, IsUUID, IsArray, ArrayMinSize, ValidateNested } from 'class-validator';

export class CreateRuneOrderDto {
  @IsUUID()
  id: string;

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

export class BatchCreateRuneOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  orders: CreateRuneOrderDto[];
}

export class BatchDeleteRuneOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  orderIds: string[];
}
