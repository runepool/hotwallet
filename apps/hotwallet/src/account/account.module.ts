import { OrdClientModule } from '@app/blockchain/common/ord-client/ord-client.module';
import { DatabaseModule } from '@app/database';
import { WalletModule } from '@app/wallet';
import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { BlockchainModule } from '@app/blockchain';
import { RunesModule } from '@app/blockchain/runes/runes.module';

@Module({
  imports: [WalletModule, DatabaseModule, RunesModule, OrdClientModule, BlockchainModule],
  providers: [AccountService],
  exports: [AccountService],

})
export class AccountModule { }
