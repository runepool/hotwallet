import { OrdClientModule } from '@app/blockchain/common/ord-client/ord-client.module';
import { NostrModule } from '@app/nostr';
import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Module({
  imports: [WalletModule, OrdClientModule, NostrModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule { }
