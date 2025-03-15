import { Module } from '@nestjs/common';
import { RuneOrdersDatabaseModule } from '@app/exchange-database/rune-orders/rune-orders-database.module';
import { RuneOrdersService } from './rune-orders.service';
import { RuneOrdersController } from './rune-orders.controller';
import { EngineModule } from '@app/engine';

@Module({
  imports: [RuneOrdersDatabaseModule, EngineModule],
  controllers: [RuneOrdersController],
  providers: [RuneOrdersService],
})
export class RuneOrdersModule { }
