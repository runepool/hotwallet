import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class AutoRebalanceConfigDto {
  @ApiProperty({ description: 'Asset name for rebalancing configuration', example: 'RUNE' })
  @IsString()
  @IsNotEmpty()
  assetName: string;

  @ApiProperty({ description: 'Whether auto rebalancing is enabled for this asset', example: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ description: 'Spread percentage for rebalancing', example: 0.5, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  spread?: number;
}

export class AutoRebalanceResponseDto extends AutoRebalanceConfigDto {
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
