import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutoRebalanceConfiguration } from '../entities/auto-rebalance-config.entity';
import { AutoRebalanceConfigService } from './auto-rebalance.service';

@Module({
  imports: [TypeOrmModule.forFeature([AutoRebalanceConfiguration])],
  providers: [AutoRebalanceConfigService],
  exports: [AutoRebalanceConfigService],
})
export class AutoRebalanceConfigModule {}
