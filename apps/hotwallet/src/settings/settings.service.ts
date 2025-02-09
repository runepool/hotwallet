import { Injectable } from '@nestjs/common';
import { UserSettings } from './settings.controller';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { BitcoinWalletService } from '@app/wallet';
import { OrdClient } from '@app/blockchain/common/ord-client/client';
import { NostrService } from '@app/nostr';

@Injectable()
export class SettingsService {
  constructor(
    private readonly walletService: BitcoinWalletService,
    private readonly ordClient: OrdClient,
    private readonly nostrService: NostrService,
    private readonly dbSettingsService: DatabaseSettingsService) { }

  async getSettings(): Promise<UserSettings> {
    const settings = await this.dbSettingsService.getSettings();
    return {
      bitcoinPrivateKey: settings.bitcoinPrivateKey ? 'xxx' : '',
      ordUrl: settings.ordUrl,
      nostrRelays: settings.nostrRelays,
      nostrPrivateKey: settings.nostrPrivateKey ? 'xxx' : '',
      nostrPublicKey: settings.nostrPublicKey,
    };
  }

  async updateSettings(newSettings: UserSettings): Promise<void> {
    await this.dbSettingsService.updateSettings({
      bitcoinPrivateKey: newSettings.bitcoinPrivateKey,
      ordUrl: newSettings.ordUrl,
      nostrRelays: newSettings.nostrRelays,
      nostrPrivateKey: newSettings.nostrPrivateKey,
      nostrPublicKey: newSettings.nostrPublicKey,
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

    // Update Nostr if private key changes
    if (newSettings.nostrPrivateKey) {
      await this.nostrService.updateKeys();
    }
  }
}
