import { Injectable, NotFoundException } from '@nestjs/common';
import { AutoRebalanceConfigService } from '@app/database/auto-rebalance/auto-rebalance.service';
import { AutoRebalanceConfigDto } from '@app/database/auto-rebalance/dto/auto-rebalance.dto';
import { AutoRebalanceConfiguration } from '@app/database/entities/auto-rebalance-config.entity';

@Injectable()
export class RebalanceService {
  constructor(private readonly autoRebalanceConfigService: AutoRebalanceConfigService) {}

  async getAll(): Promise<AutoRebalanceConfiguration[]> {
    return this.autoRebalanceConfigService.getAll();
  }

  async get(assetName: string): Promise<AutoRebalanceConfiguration> {
    const config = await this.autoRebalanceConfigService.get(assetName);
    if (!config) {
      throw new NotFoundException(`Auto rebalance configuration for asset ${assetName} not found`);
    }
    return config;
  }

  async set(dto: AutoRebalanceConfigDto): Promise<AutoRebalanceConfiguration> {
    return this.autoRebalanceConfigService.set(dto);
  }

  async remove(assetName: string): Promise<boolean> {
    const exists = await this.autoRebalanceConfigService.get(assetName);
    if (!exists) {
      throw new NotFoundException(`Auto rebalance configuration for asset ${assetName} not found`);
    }
    return this.autoRebalanceConfigService.remove(assetName);
  }
}
