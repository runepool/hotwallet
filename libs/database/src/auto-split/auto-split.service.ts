import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoSplitConfiguration } from '../entities/auto-split-config.entity';

@Injectable()
export class AutoSplitConfigService {
  constructor(
    @InjectRepository(AutoSplitConfiguration)
    private readonly repository: Repository<AutoSplitConfiguration>,
  ) {}

  async set(config: Partial<AutoSplitConfiguration>): Promise<AutoSplitConfiguration> {
    const existingConfig = await this.repository.findOne({ where: { assetName: config.assetName } });
    if (existingConfig) {
      return this.repository.save({
        ...existingConfig,
        ...config,
      });
    }
    return this.repository.save(config);
  }

  async get(assetName: string): Promise<AutoSplitConfiguration | null> {
    return this.repository.findOne({ where: { assetName } });
  }

  async getAll(): Promise<AutoSplitConfiguration[]> {
    return this.repository.find();
  }

  async remove(assetName: string): Promise<boolean> {
    const result = await this.repository.delete({ assetName });
    return result.affected > 0;
  }
}
