import { Module } from '@nestjs/common';
import { WebSocketService } from './websocket.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule],
  providers: [WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}
