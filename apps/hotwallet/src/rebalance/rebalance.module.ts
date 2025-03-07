import { Module } from '@nestjs/common';
import { AutoRebalanceConfigModule } from '@app/database/auto-rebalance/auto-rebalance.module';
import { RebalanceController } from './rebalance.controller';
import { RebalanceService } from './rebalance.service';

@Module({
  imports: [AutoRebalanceConfigModule],
  controllers: [RebalanceController],
  providers: [RebalanceService],
  exports: [RebalanceService],
})
export class RebalanceModule {}
