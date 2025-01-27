import { Module } from '@nestjs/common';
import { NostrService } from './nostr.service';
import { DatabaseSettingsModule } from '@app/database/settings/settings.module';

@Module({
  imports: [DatabaseSettingsModule],
  providers: [NostrService],
  exports: [NostrService],
})
export class NostrModule {}
