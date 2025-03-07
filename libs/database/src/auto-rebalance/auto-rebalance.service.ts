import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoRebalanceConfiguration } from '../entities/auto-rebalance-config.entity';

@Injectable()
export class AutoRebalanceConfigService {
  constructor(
    @InjectRepository(AutoRebalanceConfiguration)
    private readonly repository: Repository<AutoRebalanceConfiguration>,
  ) {}

  async set(config: Partial<AutoRebalanceConfiguration>): Promise<AutoRebalanceConfiguration> {
    const existingConfig = await this.repository.findOne({ where: { assetName: config.assetName } });
    if (existingConfig) {
      return this.repository.save({
        ...existingConfig,
        ...config,
      });
    }
    return this.repository.save(config);
  }

  async get(assetName: string): Promise<AutoRebalanceConfiguration | null> {
    return this.repository.findOne({ where: { assetName } });
  }

  async getAll(): Promise<AutoRebalanceConfiguration[]> {
    return this.repository.find();
  }

  async remove(assetName: string): Promise<boolean> {
    const result = await this.repository.delete({ assetName });
    return result.affected > 0;
  }
}
