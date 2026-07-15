import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOBS_QUEUE } from './constants';

@Injectable()
export class QueueControlService {
  private readonly logger = new Logger(QueueControlService.name);

  constructor(
    @InjectQueue(JOBS_QUEUE)
    private readonly jobsQueue: Queue,
  ) {}

  async pause(reason?: string): Promise<void> {
    this.logger.warn({ step: 'queue_pause_start', queue: JOBS_QUEUE, reason: reason ?? null });
    await this.jobsQueue.pause();
    this.logger.warn({ step: 'queue_paused', queue: JOBS_QUEUE, reason: reason ?? null });
  }

  async resume(reason?: string): Promise<void> {
    this.logger.log({ step: 'queue_resume_start', queue: JOBS_QUEUE, reason: reason ?? null });
    await this.jobsQueue.resume();
    this.logger.log({ step: 'queue_resumed', queue: JOBS_QUEUE, reason: reason ?? null });
  }

  async isPaused(): Promise<boolean> {
    return this.jobsQueue.isPaused();
  }

  async getCounts() {
    return this.jobsQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
  }
}
