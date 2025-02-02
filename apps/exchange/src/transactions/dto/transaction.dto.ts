import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateTransactionDto {
    @IsString()
    txid: string;

    @IsString()
    @IsOptional()
    status?: string;

    @IsString()
    @IsOptional()
    type?: string;

    @IsNumber()
    @IsOptional()
    amount?: number;

    @IsString()
    @IsOptional()
    asset?: string;

    @IsString()
    @IsOptional()
    address?: string;
}

export class UpdateTransactionDto {
    @IsString()
    @IsOptional()
    status?: string;

    @IsString()
    @IsOptional()
    type?: string;

    @IsNumber()
    @IsOptional()
    amount?: number;

    @IsString()
    @IsOptional()
    asset?: string;

    @IsString()
    @IsOptional()
    address?: string;
}
