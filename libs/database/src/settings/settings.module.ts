import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsEntity } from '../entities/settings.entity';
import { DatabaseSettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SettingsEntity])],
  providers: [DatabaseSettingsService],
  exports: [DatabaseSettingsService],
})
export class DatabaseSettingsModule {}
