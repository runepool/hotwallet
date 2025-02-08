import { Module } from '@nestjs/common';

import { EventHandlerService } from './event-handler/event-handler.service';
import { ExecutionService } from './execution.service';

@Module({
  providers: [ExecutionService, EventHandlerService],
  exports: [ExecutionService],
})
export class ExecutionModule { }
