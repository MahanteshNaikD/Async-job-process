import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { JobsRepository, JobStatus } from '@app/jobs';
import { JOBS_QUEUE } from './constants';
import { DeadLetterService, JobsQueuePayload } from './dead-letter.service';
import { JobHandlerRegistry } from './handlers/job-handler.registry';

function workerConcurrency(): number {
  return Math.max(1, parseInt(process.env.QUEUE_CONCURRENCY ?? '5', 10));
}

@Processor(JOBS_QUEUE, {
  concurrency: workerConcurrency(),
})
@Injectable()
export class JobProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(JobProcessor.name);
  private readonly workerId = `worker-${process.pid}`;

  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly handlers: JobHandlerRegistry,
    private readonly deadLetter: DeadLetterService,
    private readonly config: ConfigService,
  ) {
    super();
    this.logger.log({
      step: 'processor_ready',
      workerId: this.workerId,
      concurrency: this.config.get<number>('queue.concurrency'),
      queue: JOBS_QUEUE,
    });
  }

  async process(job: Job<JobsQueuePayload>): Promise<unknown> {
    const jobId = job.data.jobId;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;

    this.logger.log({
      step: 'job_received',
      workerId: this.workerId,
      jobId,
      type: job.data.type,
      attempt,
      maxAttempts,
    });

    const record = await this.jobsRepository.findById(jobId);
    if (!record) {
      this.logger.error({ step: 'job_missing_in_db', jobId });
      throw new UnrecoverableError(`Job ${jobId} not found in database`);
    }

    this.logger.log({
      step: 'db_status_loaded',
      jobId,
      status: record.status,
      attempts: record.attempts,
    });

    if (record.status === JobStatus.Cancelled) {
      this.logger.warn({ step: 'job_skipped_cancelled', jobId });
      throw new UnrecoverableError(`Job ${jobId} was cancelled`);
    }

    if (
      record.status === JobStatus.Completed ||
      record.status === JobStatus.DeadLetter
    ) {
      this.logger.warn({
        step: 'job_skipped_terminal',
        jobId,
        status: record.status,
      });
      return { skipped: true, status: record.status };
    }

    await this.jobsRepository.markProcessing(jobId, attempt);
    this.logger.log({
      step: 'status_processing',
      workerId: this.workerId,
      jobId,
      type: job.data.type,
      attempt,
    });

    try {
      this.logger.log({
        step: 'handler_execute_start',
        jobId,
        type: job.data.type,
        attempt,
      });
      const result = await this.handlers.execute(job.data.type, job.data.payload, {
        jobId,
        type: job.data.type,
        attempt,
        maxAttempts,
      });

      await this.jobsRepository.markCompleted(jobId);
      this.logger.log({
        step: 'job_completed',
        workerId: this.workerId,
        jobId,
        type: job.data.type,
        attempt,
      });

      return result ?? { ok: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attempt >= maxAttempts;

      if (isLastAttempt) {
        this.logger.error({
          step: 'max_attempts_reached',
          workerId: this.workerId,
          jobId,
          attempt,
          error: err.message,
        });
        await this.deadLetter.moveToDeadLetter(job, err);
        await this.jobsRepository.markDeadLetter(jobId, err.message);
        this.logger.error({
          step: 'job_dead_letter',
          workerId: this.workerId,
          jobId,
          error: err.message,
          attempt,
        });
        throw new UnrecoverableError(err.message);
      }

      await this.jobsRepository.markRetrying(jobId, err.message);
      this.logger.warn({
        step: 'job_retry_scheduled',
        workerId: this.workerId,
        jobId,
        error: err.message,
        attempt,
        maxAttempts,
      });
      throw err;
    }
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error({
      step: 'worker_error',
      workerId: this.workerId,
      error: error.message,
      stack: error.stack,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error({
      step: 'bullmq_job_failed',
      workerId: this.workerId,
      jobId: job?.data?.jobId ?? job?.id,
      error: error.message,
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log({
      step: 'processor_shutdown',
      workerId: this.workerId,
    });
  }
}
