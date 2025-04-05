import { Module } from '@nestjs/common';
import { WebSocketService } from './websocket.service';
import { DatabaseModule } from '@app/database';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';

@Module({
  imports: [DatabaseModule, DatabaseSettingsModule],
  providers: [WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}
