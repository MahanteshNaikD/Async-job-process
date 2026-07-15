import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobHandlerContext } from './job-handler';

@Injectable()
export class EmailSendHandler implements JobHandler {
  readonly type = 'email.send';
  private readonly logger = new Logger(EmailSendHandler.name);

  async handle(
    payload: Record<string, unknown>,
    ctx: JobHandlerContext,
  ): Promise<{ sent: boolean }> {
    // Simulated side effect — keep idempotent for retries.
    this.logger.log({
      step: 'email_send_simulated',
      jobId: ctx.jobId,
      to: payload['to'],
      template: payload['template'],
      attempt: ctx.attempt,
    });
    return { sent: true };
  }
}
