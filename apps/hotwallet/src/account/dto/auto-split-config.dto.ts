import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString } from 'class-validator';

export class AutoSplitConfigDto {
  @ApiProperty({ description: 'The name of the asset to auto-split' })
  @IsString()
  asset_name: string;

  @ApiProperty({ description: 'Whether auto-split is enabled for this asset' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Maximum cost in sats for auto-split transactions' })
  @IsNumber()
  max_cost: number;

  @ApiProperty({ description: 'Size of each split in the asset amount' })
  @IsNumber()
  split_size: number;
}
