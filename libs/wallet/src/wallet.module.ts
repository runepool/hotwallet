import { Module } from '@nestjs/common';
import { BitcoinWalletService } from './wallet.service';

@Module({
  providers: [BitcoinWalletService],
  exports: [BitcoinWalletService],
})
export class WalletModule { }
