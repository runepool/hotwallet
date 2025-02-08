import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RuneOrdersService } from './rune-orders-database.service';
import { RuneOrder } from '../entities/rune-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RuneOrder])],
  providers: [RuneOrdersService],
  exports: [RuneOrdersService],
})
export class RuneOrdersDatabaseModule { }
