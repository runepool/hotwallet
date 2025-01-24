import { Module } from '@nestjs/common';
import { RuneOrdersController } from './rune-orders/rune-orders.controller';
import { RuneOrdersModule } from "./rune-orders/rune-orders.module";
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule,
    RuneOrdersModule],
  controllers: [RuneOrdersController],
  providers: [],
})
export class AppModule { }
