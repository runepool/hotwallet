import { ApiProperty } from '@nestjs/swagger';

export class CreateRuneOrderDto {
  @ApiProperty({ description: 'The rune being traded', example: 'BTC' })
  rune: string;

  @ApiProperty({ description: 'The quantity of the rune', example: '1' }) // Represent BigInt as string in Swagger
  quantity: string;

  @ApiProperty({ description: 'The price per unit of the rune', example: '45000' }) // Represent BigInt as string in Swagger
  price: string;
}

export class UpdateRuneOrderDto {
  @ApiProperty({ description: 'The updated status of the rune order', example: 'completed', required: false })
  status?: 'open' | 'completed' | 'cancelled';

  @ApiProperty({ description: 'The updated price', example: '46000', required: false }) // Represent BigInt as string in Swagger
  price?: string;

  @ApiProperty({ description: 'The updated quantity', example: '2', required: false }) // Represent BigInt as string in Swagger
  quantity?: string;
}

export class CreateBatchRuneOrderDto {
  @ApiProperty({ description: 'An array of rune orders to create', type: [CreateRuneOrderDto] })
  orders: CreateRuneOrderDto[];
}
