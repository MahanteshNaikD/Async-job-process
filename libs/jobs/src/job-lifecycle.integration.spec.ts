import { ConfigService } from '@nestjs/config';
import { JobStatus } from './enums/job-status.enum';
import { JobsService } from './jobs.service';
import { Job } from './models/job.model';
import { JobProducer } from '@app/queue/job.producer';
import { JobProcessor } from '@app/queue/job.processor';
import { DeadLetterService } from '@app/queue/dead-letter.service';
import { JobHandlerRegistry } from '@app/queue/handlers/job-handler.registry';
import { DemoFailHandler, DemoSuccessHandler } from '@app/queue/handlers/demo.handlers';
import { Job as BullJob, UnrecoverableError } from 'bullmq';

/**
 * Integration-style test: JobsService → in-memory store → JobProcessor
 * covers the complete lifecycle without Redis/Postgres.
 */
class InMemoryJobsRepository {
  private readonly store = new Map<string, Job>();

  async create(input: {
    type: string;
    payload: Record<string, unknown>;
    priority?: number;
    maxAttempts?: number;
    availableAt?: Date;
    idempotencyKey?: string | null;
    status?: JobStatus;
  }): Promise<Job> {
    const now = new Date();
    const job = {
      id: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey ?? null,
      type: input.type,
      payload: input.payload,
      status: input.status ?? JobStatus.Queued,
      priority: input.priority ?? 0,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      availableAt: input.availableAt ?? now,
      lastError: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    } as Job;
    this.store.set(job.id, job);
    return job;
  }

  async findById(id: string): Promise<Job | null> {
    return this.store.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Job | null> {
    return (
      [...this.store.values()].find((j) => j.idempotencyKey === key) ?? null
    );
  }

  async markEnqueueFailed(id: string, errorMessage: string): Promise<void> {
    const job = this.store.get(id);
    if (job) {
      job.lastError = errorMessage;
      job.updatedAt = new Date();
    }
  }

  async markProcessing(id: string, attempt: number): Promise<void> {
    const job = this.mustGet(id);
    job.status = JobStatus.Processing;
    job.attempts = attempt;
    job.startedAt = new Date();
    job.lastError = null;
    job.updatedAt = new Date();
  }

  async markCompleted(id: string): Promise<void> {
    const job = this.mustGet(id);
    job.status = JobStatus.Completed;
    job.completedAt = new Date();
    job.lastError = null;
    job.updatedAt = new Date();
  }

  async markRetrying(id: string, errorMessage: string): Promise<void> {
    const job = this.mustGet(id);
    job.status = JobStatus.Retrying;
    job.lastError = errorMessage;
    job.updatedAt = new Date();
  }

  async markDeadLetter(id: string, errorMessage: string): Promise<void> {
    const job = this.mustGet(id);
    job.status = JobStatus.DeadLetter;
    job.lastError = errorMessage;
    job.completedAt = new Date();
    job.updatedAt = new Date();
  }

  private mustGet(id: string): Job {
    const job = this.store.get(id);
    if (!job) {
      throw new Error(`missing ${id}`);
    }
    return job;
  }
}

describe('Job lifecycle integration', () => {
  let repo: InMemoryJobsRepository;
  let jobsService: JobsService;
  let processor: JobProcessor;
  let enqueued: Array<{ id: string; type: string; maxAttempts: number }>;

  beforeEach(() => {
    repo = new InMemoryJobsRepository();
    enqueued = [];

    const producer = {
      enqueue: jest.fn(async (input: { id: string; type: string; maxAttempts: number }) => {
        enqueued.push(input);
      }),
    } as unknown as JobProducer;

    jobsService = new JobsService(repo as never, producer);

    const registry = new JobHandlerRegistry([
      new DemoSuccessHandler(),
      new DemoFailHandler(),
    ]);

    const deadLetter = {
      moveToDeadLetter: jest.fn().mockResolvedValue(undefined),
    } as unknown as DeadLetterService;

    const config = {
      get: jest.fn().mockReturnValue(5),
    } as unknown as ConfigService;

    processor = new JobProcessor(repo as never, registry, deadLetter, config);
  });

  function asBullJob(
    jobId: string,
    type: string,
    attemptsMade: number,
    maxAttempts: number,
  ): BullJob<{ jobId: string; type: string; payload: Record<string, unknown> }> {
    return {
      id: jobId,
      attemptsMade,
      opts: { attempts: maxAttempts },
      data: { jobId, type, payload: {} },
    } as unknown as BullJob<{
      jobId: string;
      type: string;
      payload: Record<string, unknown>;
    }>;
  }

  it('runs queued → processing → completed for demo.success', async () => {
    const { job, created } = await jobsService.create({
      type: 'demo.success',
      payload: { hello: 'world' },
      maxAttempts: 3,
    });

    expect(created).toBe(true);
    expect(job.status).toBe(JobStatus.Queued);
    expect(enqueued).toHaveLength(1);

    await processor.process(asBullJob(job.id, job.type, 0, 3));

    const final = await repo.findById(job.id);
    expect(final?.status).toBe(JobStatus.Completed);
    expect(final?.attempts).toBe(1);
    expect(final?.completedAt).toBeInstanceOf(Date);
    expect(final?.lastError).toBeNull();
  });

  it('runs queued → retrying → dead_letter across attempts for demo.fail', async () => {
    const { job } = await jobsService.create({
      type: 'demo.fail',
      payload: {},
      maxAttempts: 2,
    });

    await expect(
      processor.process(asBullJob(job.id, job.type, 0, 2)),
    ).rejects.toThrow(/forced failure/);

    let current = await repo.findById(job.id);
    expect(current?.status).toBe(JobStatus.Retrying);
    expect(current?.attempts).toBe(1);

    await expect(
      processor.process(asBullJob(job.id, job.type, 1, 2)),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    current = await repo.findById(job.id);
    expect(current?.status).toBe(JobStatus.DeadLetter);
    expect(current?.attempts).toBe(2);
    expect(current?.lastError).toMatch(/forced failure/);
  });

  it('idempotent submission does not create a second lifecycle', async () => {
    const first = await jobsService.create(
      { type: 'demo.success', payload: {}, idempotencyKey: 'life-1' },
      'life-1',
    );
    await processor.process(
      asBullJob(first.job.id, first.job.type, 0, 3),
    );

    const second = await jobsService.create(
      { type: 'demo.success', payload: {}, idempotencyKey: 'life-1' },
      'life-1',
    );

    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    expect(enqueued).toHaveLength(1);

    const stored = await repo.findById(first.job.id);
    expect(stored?.status).toBe(JobStatus.Completed);
  });
});
