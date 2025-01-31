import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutoSplitConfiguration } from '../entities/auto-split-config.entity';
import { AutoSplitConfigService } from './auto-split.service';

@Module({
  imports: [TypeOrmModule.forFeature([AutoSplitConfiguration])],
  providers: [AutoSplitConfigService],
  exports: [AutoSplitConfigService],
})
export class AutoSplitConfigModule {}
