import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobsRepository } from '@app/jobs';
import { JOBS_DLQ, JOBS_QUEUE, QueueControlService } from '@app/queue';

export interface MetricsSnapshot {
  queueLength: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  queue: Record<string, number>;
  dlq: Record<string, number>;
  jobsByStatus: Record<string, number>;
  collectedAt: string;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly queueControl: QueueControlService,
    private readonly jobsRepository: JobsRepository,
    @InjectQueue(JOBS_DLQ)
    private readonly dlq: Queue,
  ) {}

  async snapshot(): Promise<MetricsSnapshot> {
    const [queue, dlq, jobsByStatus] = await Promise.all([
      this.queueControl.getCounts(),
      this.dlq.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
      ),
      this.jobsRepository.countByStatus(),
    ]);

    const snapshot: MetricsSnapshot = {
      queueLength: queue.waiting ?? 0,
      activeJobs: queue.active ?? 0,
      completedJobs: queue.completed ?? 0,
      failedJobs: queue.failed ?? 0,
      delayedJobs: queue.delayed ?? 0,
      queue,
      dlq,
      jobsByStatus,
      collectedAt: new Date().toISOString(),
    };

    this.logger.debug({
      msg: 'metrics_snapshot',
      queueName: JOBS_QUEUE,
      queueLength: snapshot.queueLength,
      activeJobs: snapshot.activeJobs,
    });
    return snapshot;
  }
}
