import { Module } from '@nestjs/common';
import { RuneOrdersController } from './rune-orders/rune-orders.controller';
import { RuneOrdersModule } from "./rune-orders/rune-orders.module";
import { DatabaseModule } from '@app/database';
import { AccountModule } from './account/account.module';
import { AccountController } from './account/account.controller';

@Module({
  imports: [
    DatabaseModule,
    RuneOrdersModule,
    AccountModule],
  controllers: [RuneOrdersController, AccountController],
  providers: [],
})
export class AppModule { }
