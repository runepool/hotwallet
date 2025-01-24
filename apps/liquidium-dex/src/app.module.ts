import { EngineModule } from '@app/engine';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountController } from './account/account.controller';
import { AccountModule } from './account/account.module';
import { RuneOrdersController } from './rune-orders/rune-orders.controller';
import { RuneOrdersModule } from "./rune-orders/rune-orders.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RuneOrdersModule,
    AccountModule,
    EngineModule
  ],
  controllers: [RuneOrdersController, AccountController],
  providers: [],
})
export class AppModule { }
