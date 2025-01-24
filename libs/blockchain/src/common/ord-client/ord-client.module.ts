import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrdClient } from './client';

@Module({
  providers: [OrdClient],
  imports: [HttpModule],
  exports: [OrdClient]
})
export class OrdClientModule { }
