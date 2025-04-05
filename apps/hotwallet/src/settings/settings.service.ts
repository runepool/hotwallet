import { Injectable } from '@nestjs/common';
import { UserSettings } from './settings.controller';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { BitcoinWalletService } from '@app/wallet';
import { OrdClient } from '@app/blockchain/common/ord-client/client';

@Injectable()
export class SettingsService {
  constructor(
    private readonly walletService: BitcoinWalletService,
    private readonly ordClient: OrdClient,
    private readonly dbSettingsService: DatabaseSettingsService) { }

  async getSettings(): Promise<UserSettings> {
    const settings = await this.dbSettingsService.getSettings();
    return {
      bitcoinPrivateKey: settings.bitcoinPrivateKey ? 'xxx' : '',
      ordUrl: settings.ordUrl,
      websocketUrl: settings.websocketUrl || 'wss://ws.runepool.io',
    };
  }

  async updateSettings(newSettings: UserSettings): Promise<void> {
    await this.dbSettingsService.updateSettings({
      bitcoinPrivateKey: newSettings.bitcoinPrivateKey,
      ordUrl: newSettings.ordUrl,
      websocketUrl: newSettings.websocketUrl,
    });

    // Reinitialize wallet if bitcoin private key changes
    if (newSettings.bitcoinPrivateKey) {
      this.walletService.reset();
      await this.walletService.init();
    }

    // Update OrdClient if ordUrl changes
    if (newSettings.ordUrl) {
      await this.ordClient.updateEndpoint();
    }
  }
}
