import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  JOB_HANDLERS,
  JobHandler,
  JobHandlerContext,
} from './job-handler';

@Injectable()
export class JobHandlerRegistry {
  private readonly logger = new Logger(JobHandlerRegistry.name);
  private readonly byType = new Map<string, JobHandler>();

  constructor(
    @Optional()
    @Inject(JOB_HANDLERS)
    handlers: JobHandler[] | JobHandler | null,
  ) {
    const list = !handlers ? [] : Array.isArray(handlers) ? handlers : [handlers];
    for (const handler of list) {
      this.byType.set(handler.type, handler);
      this.logger.log(`Registered handler: ${handler.type}`);
    }
  }

  async execute(
    type: string,
    payload: Record<string, unknown>,
    ctx: JobHandlerContext,
  ): Promise<Record<string, unknown> | void> {
    const handler = this.byType.get(type);
    if (!handler) {
      this.logger.warn({
        step: 'handler_missing_using_default',
        type,
        jobId: ctx.jobId,
      });
      this.logger.log({
        step: 'default_handler_complete',
        jobId: ctx.jobId,
        type,
      });
      return { handledBy: 'default' };
    }

    this.logger.log({
      step: 'handler_dispatch',
      type,
      jobId: ctx.jobId,
      attempt: ctx.attempt,
    });
    const result = await handler.handle(payload, ctx);
    this.logger.log({
      step: 'handler_done',
      type,
      jobId: ctx.jobId,
      attempt: ctx.attempt,
    });
    return result;
  }
}
