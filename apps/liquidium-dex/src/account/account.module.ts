import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { AccountService } from './account.service';

@Module({
  imports: [WalletModule],
  providers: [AccountService],
  exports: [AccountService],

})
export class AccountModule { }
