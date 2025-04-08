import { Injectable } from '@nestjs/common';
import { UserSettings } from './settings.controller';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { BitcoinWalletService } from '@app/wallet';
import { OrdClient } from '@app/blockchain/common/ord-client/client';
import { EncryptionService } from '@app/wallet';

@Injectable()
export class SettingsService {
  constructor(
    private readonly walletService: BitcoinWalletService,
    private readonly ordClient: OrdClient,
    private readonly dbSettingsService: DatabaseSettingsService,
    private readonly encryptionService: EncryptionService) { }

  async getSettings(): Promise<UserSettings> {
    const settings = await this.dbSettingsService.getSettings();
    return {
      bitcoinPrivateKey: settings.bitcoinPrivateKey ? 'xxx' : '',
      ordUrl: settings.ordUrl,
      websocketUrl: settings.websocketUrl || 'wss://ws.runepool.org',
      hasPassword: settings.hasPassword || false,
    };
  }

  async updateSettings(newSettings: UserSettings, password?: string): Promise<void> {
    // Handle the case where we're setting a new Bitcoin private key with a password
    if (newSettings.bitcoinPrivateKey && newSettings.bitcoinPrivateKey !== 'xxx' && password) {
      // Encrypt the private key with the provided password
      newSettings.bitcoinPrivateKey = await this.walletService.encryptPrivateKey(
        newSettings.bitcoinPrivateKey,
        password
      );
    }

    // If a password is provided, mark that password has been set
    const hasPassword = password ? true : undefined;
    
    await this.dbSettingsService.updateSettings({
      bitcoinPrivateKey: newSettings.bitcoinPrivateKey,
      ordUrl: newSettings.ordUrl,
      websocketUrl: newSettings.websocketUrl,
      // Only update hasPassword if we're setting a password
      ...(hasPassword && { hasPassword }),
    });

    // Reinitialize wallet if bitcoin private key changes
    if (newSettings.bitcoinPrivateKey && newSettings.bitcoinPrivateKey !== 'xxx') {
      this.walletService.reset();
      try {
        await this.walletService.init(password);
      } catch (error) {
        console.error('Failed to initialize wallet:', error.message);
        // We don't rethrow here to allow settings to be saved even if wallet init fails
      }
    }

    // Update OrdClient if ordUrl changes
    if (newSettings.ordUrl) {
      await this.ordClient.updateEndpoint();
    }
  }

  /**
   * Validates if a password can decrypt the stored Bitcoin private key
   * @param password The password to validate
   * @returns True if the password is valid, false otherwise
   */
  async validatePassword(password: string): Promise<boolean> {
    try {
      const settings = await this.dbSettingsService.getSettings();
      
      // If no private key or no password has been set, validation fails
      if (!settings.bitcoinPrivateKey || !settings.hasPassword) {
        return false;
      }
      
      await this.walletService.init(password);
      // If decryption succeeds, the password is valid
      return true;
    } catch (error) {
      // If decryption fails, the password is invalid
      console.log('Password validation failed:', error.message);
      return false;
    }
  }

  /**
   * Sets up or changes the password for the Bitcoin private key
   * @param password The new password to use
   * @param bitcoinPrivateKey Optional Bitcoin private key to set during password setup
   * @param oldPassword Optional old password, required when changing an existing password
   */
  async setupPassword(password: string, bitcoinPrivateKey?: string, oldPassword?: string): Promise<void> {
    if (!password) {
      throw new Error('Password cannot be empty');
    }

    const settings = await this.dbSettingsService.getSettings();
    let privateKey = bitcoinPrivateKey || settings.bitcoinPrivateKey;

    if (!privateKey) {
      throw new Error('Bitcoin private key not set. Please provide a Bitcoin private key.');
    }

    try {
      // Check if the key is already encrypted and we're not providing a new one
      if (!bitcoinPrivateKey && settings.bitcoinPrivateKey && this.encryptionService.isEncrypted(settings.bitcoinPrivateKey)) {
        // For password changes, we need the old password to decrypt the existing key
        if (!oldPassword) {
          throw new Error('Old password is required when changing password without providing a new Bitcoin private key');
        }
        
        try {
          // Decrypt the existing key with the old password
          privateKey = await this.encryptionService.decrypt(settings.bitcoinPrivateKey, oldPassword);
        } catch (error) {
          throw new Error('Invalid old password or corrupted key data');
        }
      }

      // Encrypt the private key with the new password
      const encryptedKey = await this.walletService.encryptPrivateKey(
        privateKey,
        password
      );

      // Update the settings with the newly encrypted key and set hasPassword flag
      await this.dbSettingsService.updateSettings({
        bitcoinPrivateKey: encryptedKey,
        ordUrl: settings.ordUrl,
        websocketUrl: settings.websocketUrl,
        hasPassword: true,
      });

      // Initialize the wallet with the new password
      this.walletService.reset();
      await this.walletService.init(password);

      console.log('Password set up successfully');
    } catch (error) {
      console.error('Failed to set up password:', error.message);
      throw new Error(`Failed to set up password: ${error.message}`);
    }
  }
}
