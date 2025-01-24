import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BestinslotClient } from './client';

@Module({
  providers: [BestinslotClient],
  imports: [HttpModule, ConfigModule],
  exports: [BestinslotClient]
})
export class BestinslotClientModule {}
