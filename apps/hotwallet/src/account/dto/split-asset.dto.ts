import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SplitAssetDto {
  @ApiProperty({ description: 'Name of the asset to split' })
  @IsString()
  asset_name: string;

  @ApiProperty({ description: 'Number of splits to create' })
  @IsNumber()
  @Min(1)
  splits: number;

  @ApiProperty({ description: 'Amount per split' })
  @IsNumber()
  @Min(1)
  amount_per_split: number;
}
