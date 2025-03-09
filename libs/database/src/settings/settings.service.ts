import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsEntity } from '../entities/settings.entity';

@Injectable()
export class DatabaseSettingsService {
  constructor(
    @InjectRepository(SettingsEntity)
    private readonly settingsRepository: Repository<SettingsEntity>
  ) {}

  async getSettings(): Promise<SettingsEntity> {
    const settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      // Return default settings if none exist
    return this.settingsRepository.save({
        ordUrl: 'https://ord.runepool.org',
        nostrRelays: ['wss://relay.runepool.io', 'wss://nostr.zebedee.cloud'],
      });
    }
    return settings;
  }

  async updateSettings(settings: Partial<SettingsEntity>): Promise<SettingsEntity> {
    let existingSettings = await this.getSettings();
    Object.keys(settings).forEach(key => {
      if (key.endsWith('PrivateKey') && settings[key] === 'xxx') {
        delete settings[key];
      }
    });
    Object.assign(existingSettings, settings);
    return this.settingsRepository.save(existingSettings);
  }
}
