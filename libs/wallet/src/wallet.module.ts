import { Module } from '@nestjs/common';
import { BitcoinWalletService } from './wallet.service';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';

@Module({
  imports: [DatabaseSettingsModule],
  providers: [BitcoinWalletService],
  exports: [BitcoinWalletService],
})
export class WalletModule {}
