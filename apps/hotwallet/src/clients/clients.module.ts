import { WalletModule } from '@app/wallet';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ExchangeClient } from './exchange.client';

@Module({
  imports: [HttpModule, WalletModule],
  providers: [ExchangeClient],
  exports: [ExchangeClient],
})
export class ClientsModule {}
