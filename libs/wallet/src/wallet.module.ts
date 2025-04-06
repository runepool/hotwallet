import { Module } from '@nestjs/common';
import { BitcoinWalletService } from './wallet.service';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [DatabaseSettingsModule],
  providers: [BitcoinWalletService, EncryptionService],
  exports: [BitcoinWalletService, EncryptionService],
})
export class WalletModule {}
