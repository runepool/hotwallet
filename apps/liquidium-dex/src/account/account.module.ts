import { OrdClientModule } from '@app/blockchain/common/ord-client/ord-client.module';
import { DatabaseModule } from '@app/database';
import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { AccountService } from './account.service';

@Module({
  imports: [WalletModule, DatabaseModule,  OrdClientModule],
  providers: [AccountService],
  exports: [AccountService],

})
export class AccountModule { }
