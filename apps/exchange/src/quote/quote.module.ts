import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuneOrder } from '@app/exchange-database/entities/rune-order.entity';
import { QuoteService } from './quote.service';
import { RunesModule } from '@app/blockchain/runes/runes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RuneOrder]),
    RunesModule
  ],
  providers: [QuoteService],
  exports: [QuoteService]
})
export class QuoteModule {}
