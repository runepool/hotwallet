import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExchangeClient } from './exchange.client';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';

@Module({
  imports: [HttpModule, DatabaseSettingsModule],
  providers: [ExchangeClient],
  exports: [ExchangeClient],
})
export class ClientsModule {}
