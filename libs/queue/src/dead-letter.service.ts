import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { JOBS_DLQ } from './constants';

export interface JobsQueuePayload {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(
    @InjectQueue(JOBS_DLQ)
    private readonly dlq: Queue,
  ) {}

  async moveToDeadLetter(
    job: Job<JobsQueuePayload>,
    error: Error,
  ): Promise<void> {
    this.logger.error({
      step: 'dlq_enqueue_start',
      jobId: job.data.jobId,
      type: job.data.type,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });

    await this.dlq.add(
      'dead-letter',
      {
        originalJobId: job.data.jobId,
        type: job.data.type,
        payload: job.data.payload,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString(),
      },
      {
        jobId: `dlq-${job.data.jobId}`,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    this.logger.error({
      step: 'dlq_enqueue_ok',
      jobId: job.data.jobId,
      type: job.data.type,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });
  }
}
