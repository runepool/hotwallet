import { Module } from '@nestjs/common';
import { WebSocketService } from './websocket.service';
import { DatabaseModule } from '@app/database';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';
import { WalletModule } from '@app/wallet';

@Module({
  imports: [DatabaseModule, DatabaseSettingsModule, WalletModule],
  providers: [WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}
