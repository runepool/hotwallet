import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SandshrewClient } from './client';

@Module({
  providers: [SandshrewClient],
  imports: [HttpModule],
  exports: [SandshrewClient]
})
export class SandshrewClientModule { }
