import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobHandlerContext } from './job-handler';

@Injectable()
export class DemoSuccessHandler implements JobHandler {
  readonly type = 'demo.success';
  private readonly logger = new Logger(DemoSuccessHandler.name);

  async handle(
    payload: Record<string, unknown>,
    ctx: JobHandlerContext,
  ): Promise<void> {
    this.logger.log({
      step: 'demo_success_run',
      jobId: ctx.jobId,
      attempt: ctx.attempt,
      payload,
    });
  }
}

@Injectable()
export class DemoFailHandler implements JobHandler {
  readonly type = 'demo.fail';
  private readonly logger = new Logger(DemoFailHandler.name);

  async handle(
    _payload: Record<string, unknown>,
    ctx: JobHandlerContext,
  ): Promise<void> {
    this.logger.warn({
      step: 'demo_fail_forced',
      jobId: ctx.jobId,
      attempt: ctx.attempt,
      maxAttempts: ctx.maxAttempts,
    });
    throw new Error(
      `demo.fail forced failure (attempt ${ctx.attempt}/${ctx.maxAttempts})`,
    );
  }
}

@Injectable()
export class DemoFlakyHandler implements JobHandler {
  readonly type = 'demo.flaky';
  private readonly logger = new Logger(DemoFlakyHandler.name);

  async handle(
    _payload: Record<string, unknown>,
    ctx: JobHandlerContext,
  ): Promise<void> {
    if (ctx.attempt < 2) {
      this.logger.warn({
        step: 'demo_flaky_fail',
        jobId: ctx.jobId,
        attempt: ctx.attempt,
      });
      throw new Error(`demo.flaky failing on attempt ${ctx.attempt}`);
    }
    this.logger.log({
      step: 'demo_flaky_recovered',
      jobId: ctx.jobId,
      attempt: ctx.attempt,
    });
  }
}
