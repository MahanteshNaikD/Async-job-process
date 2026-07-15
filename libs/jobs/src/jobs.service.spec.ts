import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JobStatus } from './enums/job-status.enum';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';
import { JobProducer } from '@app/queue/job.producer';
import { Job } from './models/job.model';

function makeJob(overrides: Partial<Job> = {}): Job {
  const now = new Date();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    idempotencyKey: null,
    type: 'demo.success',
    payload: { ok: true },
    status: JobStatus.Queued,
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    availableAt: now,
    lastError: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Job;
}

describe('JobsService — job submission', () => {
  let service: JobsService;
  let repository: jest.Mocked<JobsRepository>;
  let producer: jest.Mocked<JobProducer>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      countByStatus: jest.fn(),
      markEnqueueFailed: jest.fn(),
      markProcessing: jest.fn(),
      markCompleted: jest.fn(),
      markRetrying: jest.fn(),
      markDeadLetter: jest.fn(),
      markCancelled: jest.fn(),
      updateStatus: jest.fn(),
      findLatestByIdempotencyKey: jest.fn(),
    } as unknown as jest.Mocked<JobsRepository>;

    producer = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<JobProducer>;

    service = new JobsService(repository, producer);
  });

  it('creates a job, persists it, and enqueues to BullMQ', async () => {
    const created = makeJob({ type: 'email.send', priority: 10 });
    repository.findByIdempotencyKey.mockResolvedValue(null);
    repository.create.mockResolvedValue(created);

    const result = await service.create({
      type: 'email.send',
      payload: { to: 'a@b.com' },
      priority: 10,
    });

    expect(result.created).toBe(true);
    expect(result.job.id).toBe(created.id);
    expect(result.job.status).toBe(JobStatus.Queued);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'email.send',
        payload: { to: 'a@b.com' },
        priority: 10,
        status: JobStatus.Queued,
      }),
    );
    expect(producer.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: created.id,
        type: 'email.send',
        priority: 10,
      }),
    );
  });

  it('marks job delayed when delayMs > 0', async () => {
    const created = makeJob({ status: JobStatus.Delayed });
    repository.create.mockResolvedValue(created);

    await service.create({
      type: 'demo.success',
      payload: {},
      delayMs: 5_000,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: JobStatus.Delayed }),
    );
    expect(producer.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ delayMs: 5_000 }),
    );
  });

  it('schedules from runAt absolute timestamp', async () => {
    const created = makeJob({ status: JobStatus.Delayed });
    repository.create.mockResolvedValue(created);
    const runAt = new Date(Date.now() + 60_000).toISOString();

    await service.create({
      type: 'demo.success',
      payload: {},
      runAt,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.Delayed,
        availableAt: new Date(runAt),
      }),
    );
    expect(producer.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        delayMs: expect.any(Number),
      }),
    );
    const enqueued = producer.enqueue.mock.calls[0][0];
    expect(enqueued.delayMs).toBeGreaterThan(50_000);
    expect(enqueued.delayMs).toBeLessThanOrEqual(60_000);
  });

  it('rejects runAt in the past', async () => {
    await expect(
      service.create({
        type: 'demo.success',
        payload: {},
        runAt: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/runAt must be in the future/);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects when both runAt and delayMs are provided', async () => {
    await expect(
      service.create({
        type: 'demo.success',
        payload: {},
        runAt: new Date(Date.now() + 60_000).toISOString(),
        delayMs: 1000,
      }),
    ).rejects.toThrow(/either runAt or delayMs/);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns existing job on idempotent replay (no second enqueue)', async () => {
    const existing = makeJob({
      idempotencyKey: 'key-1',
      status: JobStatus.Completed,
    });
    repository.findByIdempotencyKey.mockResolvedValue(existing);

    const result = await service.create(
      { type: 'demo.success', payload: {}, idempotencyKey: 'key-1' },
      'key-1',
    );

    expect(result.created).toBe(false);
    expect(result.job.id).toBe(existing.id);
    expect(repository.create).not.toHaveBeenCalled();
    expect(producer.enqueue).not.toHaveBeenCalled();
  });

  it('prefers Idempotency-Key header over body', async () => {
    const existing = makeJob({ idempotencyKey: 'from-header' });
    repository.findByIdempotencyKey.mockResolvedValue(existing);

    await service.create(
      {
        type: 'demo.success',
        payload: {},
        idempotencyKey: 'from-body',
      },
      'from-header',
    );

    expect(repository.findByIdempotencyKey).toHaveBeenCalledWith('from-header');
  });

  it('marks enqueue failure and throws ServiceUnavailableException', async () => {
    const created = makeJob();
    repository.create.mockResolvedValue(created);
    producer.enqueue.mockRejectedValue(new Error('redis down'));

    await expect(
      service.create({ type: 'demo.success', payload: {} }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(repository.markEnqueueFailed).toHaveBeenCalledWith(
      created.id,
      expect.stringContaining('enqueue_failed: redis down'),
    );
  });

  it('throws NotFoundException when job id is missing', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists dead-letter jobs with fixed dead_letter status filter', async () => {
    const dlqJob = makeJob({
      status: JobStatus.DeadLetter,
      lastError: 'fatal',
      completedAt: new Date(),
    });
    repository.findMany.mockResolvedValue({ rows: [dlqJob], count: 1 });

    const result = await service.listDeadLetter({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe(JobStatus.DeadLetter);
    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.DeadLetter,
        page: 1,
        limit: 10,
      }),
    );
  });
});

describe('JobsService — cancel', () => {
  let service: JobsService;
  let repository: jest.Mocked<JobsRepository>;
  let producer: jest.Mocked<JobProducer>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      markCancelled: jest.fn(),
    } as unknown as jest.Mocked<JobsRepository>;

    producer = {
      remove: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<JobProducer>;

    service = new JobsService(repository, producer);
  });

  it('cancels a queued job and removes it from BullMQ', async () => {
    const queued = makeJob({ status: JobStatus.Queued });
    const cancelled = makeJob({
      status: JobStatus.Cancelled,
      completedAt: new Date(),
    });
    repository.findById.mockResolvedValue(queued);
    repository.markCancelled.mockResolvedValue(cancelled);

    const result = await service.cancel(queued.id);

    expect(result.status).toBe(JobStatus.Cancelled);
    expect(repository.markCancelled).toHaveBeenCalledWith(
      queued.id,
      expect.arrayContaining([
        JobStatus.Queued,
        JobStatus.Delayed,
        JobStatus.Retrying,
      ]),
    );
    expect(producer.remove).toHaveBeenCalledWith(queued.id);
  });

  it('rejects cancelling a processing job', async () => {
    repository.findById.mockResolvedValue(
      makeJob({ status: JobStatus.Processing }),
    );

    await expect(service.cancel('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.markCancelled).not.toHaveBeenCalled();
    expect(producer.remove).not.toHaveBeenCalled();
  });

  it('returns existing job if already cancelled', async () => {
    const cancelled = makeJob({ status: JobStatus.Cancelled });
    repository.findById.mockResolvedValue(cancelled);

    const result = await service.cancel(cancelled.id);

    expect(result.status).toBe(JobStatus.Cancelled);
    expect(repository.markCancelled).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for unknown id', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.cancel('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
