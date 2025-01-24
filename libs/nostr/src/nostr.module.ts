import { Module } from '@nestjs/common';
import { NostrService } from './nostr.service';

@Module({
  providers: [NostrService],
  exports: [NostrService],
  imports: [NostrModule],
})
export class NostrModule { }
