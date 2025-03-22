import { Injectable } from '@nestjs/common';
import { UserSettings } from './settings.controller';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { BitcoinWalletService } from '@app/wallet';
import { OrdClient } from '@app/blockchain/common/ord-client/client';
import { WebSocketService } from '@app/websocket';
import { ExchangeClient } from '../clients/exchange.client';

@Injectable()
export class SettingsService {
  constructor(
    private readonly walletService: BitcoinWalletService,
    private readonly ordClient: OrdClient,
    private readonly webSocketService: WebSocketService,
    private readonly exchangeClient: ExchangeClient,
    private readonly dbSettingsService: DatabaseSettingsService) { }

  async getSettings(): Promise<UserSettings> {
    const settings = await this.dbSettingsService.getSettings();
    return {
      bitcoinPrivateKey: settings.bitcoinPrivateKey ? 'xxx' : '',
      ordUrl: settings.ordUrl,
      nostrRelays: settings.nostrRelays,
    };
  }

  async updateSettings(newSettings: UserSettings): Promise<void> {
    await this.dbSettingsService.updateSettings({
      bitcoinPrivateKey: newSettings.bitcoinPrivateKey,
      ordUrl: newSettings.ordUrl,
      nostrRelays: newSettings.nostrRelays,
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
