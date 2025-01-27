import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrdClient } from './client';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';

@Module({
  imports: [HttpModule, DatabaseSettingsModule],
  providers: [OrdClient],
  exports: [OrdClient],
})
export class OrdClientModule {}
