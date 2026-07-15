import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOBS_QUEUE } from './constants';

export interface EnqueueJobInput {
  id: string;
  type: string;
  priority: number;
  maxAttempts: number;
  delayMs: number;
  payload: Record<string, unknown>;
}

@Injectable()
export class JobProducer {
  private readonly logger = new Logger(JobProducer.name);

  constructor(
    @InjectQueue(JOBS_QUEUE)
    private readonly jobsQueue: Queue,
  ) {}

  /**
   * Enqueues a job using the DB UUID as BullMQ jobId for correlation.
   * API priority: higher = more urgent → converted to BullMQ (lower = higher).
   */
  async enqueue(input: EnqueueJobInput): Promise<void> {
    const bullPriority = Math.max(1, 1_000_000 - input.priority);

    this.logger.log({
      step: 'bullmq_add_start',
      jobId: input.id,
      type: input.type,
      delayMs: input.delayMs,
      priority: input.priority,
      bullPriority,
      maxAttempts: input.maxAttempts,
    });

    await this.jobsQueue.add(
      input.type,
      {
        jobId: input.id,
        type: input.type,
        payload: input.payload,
      },
      {
        jobId: input.id,
        priority: bullPriority,
        attempts: input.maxAttempts,
        delay: input.delayMs > 0 ? input.delayMs : undefined,
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log({
      step: 'bullmq_add_ok',
      jobId: input.id,
      type: input.type,
      delayMs: input.delayMs,
      priority: input.priority,
    });
  }

  /**
   * Removes a waiting/delayed/prioritized job from BullMQ (no-op if already gone).
   */
  async remove(jobId: string): Promise<boolean> {
    this.logger.log({ step: 'bullmq_remove_start', jobId });
    const job = await this.jobsQueue.getJob(jobId);
    if (!job) {
      this.logger.log({ step: 'bullmq_remove_missing', jobId });
      return false;
    }
    await job.remove();
    this.logger.log({ step: 'bullmq_remove_ok', jobId });
    return true;
  }
}
