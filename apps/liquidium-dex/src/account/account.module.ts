import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [WalletModule, DatabaseModule],
  providers: [AccountService],
  exports: [AccountService],

})
export class AccountModule { }
