import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuneOrder } from '@app/exchange-database/entities/rune-order.entity';
import { QuoteService } from './quote.service';
import { RunesModule } from '@app/blockchain/runes/runes.module';
import { EngineModule } from '@app/engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([RuneOrder]),
    RunesModule,
    EngineModule
  ],
  providers: [QuoteService],
  exports: [QuoteService]
})
export class QuoteModule {}
