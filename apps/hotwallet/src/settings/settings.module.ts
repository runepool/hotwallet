import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';
import { WalletModule } from '@app/wallet';
import { OrdClientModule } from '@app/blockchain/common/ord-client/ord-client.module';
import { NostrModule } from '@app/nostr';

@Module({
  imports: [DatabaseSettingsModule, WalletModule, OrdClientModule, NostrModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
