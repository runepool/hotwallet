import { IsString, IsNumber, IsEnum } from 'class-validator';
import { RuneOrderStatus } from '@database/entities/rune-order';

export class CreateRuneOrderDto {
  @IsString()
  rune: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  price: number;

  @IsEnum(RuneOrderStatus)
  status: RuneOrderStatus;
}

export class UpdateRuneOrderDto {
  @IsNumber()
  amount?: number;

  @IsNumber()
  price?: number;

  @IsEnum(RuneOrderStatus)
  status?: RuneOrderStatus;
}
