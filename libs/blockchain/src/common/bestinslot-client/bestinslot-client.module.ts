import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BestinslotClient } from './client';

@Module({
  providers: [BestinslotClient],
  imports: [HttpModule],
  exports: [BestinslotClient]
})
export class BestinslotClientModule {}
