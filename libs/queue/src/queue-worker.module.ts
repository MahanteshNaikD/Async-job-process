import { Module } from '@nestjs/common';
import { JobsModule } from '@app/jobs';
import { QueueModule } from './queue.module';
import { DeadLetterService } from './dead-letter.service';
import { JobProcessor } from './job.processor';
import { JOB_HANDLERS } from './handlers/job-handler';
import { JobHandlerRegistry } from './handlers/job-handler.registry';
import {
  DemoFailHandler,
  DemoFlakyHandler,
  DemoSuccessHandler,
} from './handlers/demo.handlers';
import { EmailSendHandler } from './handlers/email.handler';

/**
 * Worker-only module. Do NOT import this from the API app,
 * or API replicas will compete for jobs.
 */
@Module({
  imports: [QueueModule, JobsModule],
  providers: [
    DemoSuccessHandler,
    DemoFailHandler,
    DemoFlakyHandler,
    EmailSendHandler,
    {
      provide: JOB_HANDLERS,
      useFactory: (
        success: DemoSuccessHandler,
        fail: DemoFailHandler,
        flaky: DemoFlakyHandler,
        email: EmailSendHandler,
      ) => [success, fail, flaky, email],
      inject: [
        DemoSuccessHandler,
        DemoFailHandler,
        DemoFlakyHandler,
        EmailSendHandler,
      ],
    },
    JobHandlerRegistry,
    DeadLetterService,
    JobProcessor,
  ],
})
export class QueueWorkerModule {}
