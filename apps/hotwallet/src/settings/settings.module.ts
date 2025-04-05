import { OrdClientModule } from '@app/blockchain/common/ord-client/ord-client.module';
import { WebSocketModule } from '@app/websocket';
import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ClientsModule } from '../clients/clients.module';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';

@Module({
  imports: [WalletModule, OrdClientModule, WebSocketModule, ClientsModule, DatabaseSettingsModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule { }
