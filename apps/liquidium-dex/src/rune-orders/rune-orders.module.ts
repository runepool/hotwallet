import { Module } from '@nestjs/common';
import { RuneOrdersService } from './rune-orders.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule],
  providers: [RuneOrdersService],
  exports: [RuneOrdersService]
})
export class RuneOrdersModule { }
