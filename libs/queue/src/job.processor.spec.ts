import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';
import { JobStatus } from '@app/jobs';
import { JobProcessor } from './job.processor';
import { DeadLetterService, JobsQueuePayload } from './dead-letter.service';
import { JobHandlerRegistry } from './handlers/job-handler.registry';
import { JobsRepository } from '@app/jobs';
import { Job as JobModel } from '@app/jobs';
import { Job as BullJob } from 'bullmq';

function makeRecord(overrides: Partial<JobModel> = {}): JobModel {
  const now = new Date();
  return {
    id: '22222222-2222-4222-8222-222222222222',
    idempotencyKey: null,
    type: 'demo.success',
    payload: {},
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
  } as JobModel;
}

function makeBullJob(
  overrides: {
    attemptsMade?: number;
    attempts?: number;
    type?: string;
    jobId?: string;
  } = {},
): BullJob<JobsQueuePayload> {
  const jobId = overrides.jobId ?? '22222222-2222-4222-8222-222222222222';
  return {
    id: jobId,
    attemptsMade: overrides.attemptsMade ?? 0,
    opts: { attempts: overrides.attempts ?? 3 },
    data: {
      jobId,
      type: overrides.type ?? 'demo.success',
      payload: { n: 1 },
    },
  } as unknown as BullJob<JobsQueuePayload>;
}

describe('JobProcessor — retry logic & status updates', () => {
  let processor: JobProcessor;
  let repository: jest.Mocked<JobsRepository>;
  let handlers: jest.Mocked<JobHandlerRegistry>;
  let deadLetter: jest.Mocked<DeadLetterService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      markProcessing: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markRetrying: jest.fn().mockResolvedValue(undefined),
      markDeadLetter: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<JobsRepository>;

    handlers = {
      execute: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as jest.Mocked<JobHandlerRegistry>;

    deadLetter = {
      moveToDeadLetter: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DeadLetterService>;

    config = {
      get: jest.fn().mockReturnValue(5),
    } as unknown as jest.Mocked<ConfigService>;

    processor = new JobProcessor(repository, handlers, deadLetter, config);
  });

  it('marks processing then completed on success', async () => {
    repository.findById.mockResolvedValue(makeRecord());
    const job = makeBullJob({ attemptsMade: 0 });

    await expect(processor.process(job)).resolves.toEqual({ ok: true });

    expect(repository.markProcessing).toHaveBeenCalledWith(job.data.jobId, 1);
    expect(handlers.execute).toHaveBeenCalled();
    expect(repository.markCompleted).toHaveBeenCalledWith(job.data.jobId);
    expect(repository.markRetrying).not.toHaveBeenCalled();
    expect(deadLetter.moveToDeadLetter).not.toHaveBeenCalled();
  });

  it('marks retrying and rethrows when attempts remain', async () => {
    repository.findById.mockResolvedValue(makeRecord());
    handlers.execute.mockRejectedValue(new Error('boom'));
    const job = makeBullJob({ attemptsMade: 0, attempts: 3 });

    await expect(processor.process(job)).rejects.toThrow('boom');

    expect(repository.markProcessing).toHaveBeenCalledWith(job.data.jobId, 1);
    expect(repository.markRetrying).toHaveBeenCalledWith(
      job.data.jobId,
      'boom',
    );
    expect(repository.markDeadLetter).not.toHaveBeenCalled();
    expect(deadLetter.moveToDeadLetter).not.toHaveBeenCalled();
  });

  it('moves to DLQ and marks dead_letter on final attempt', async () => {
    repository.findById.mockResolvedValue(makeRecord());
    handlers.execute.mockRejectedValue(new Error('fatal'));
    const job = makeBullJob({ attemptsMade: 2, attempts: 3 });

    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(repository.markProcessing).toHaveBeenCalledWith(job.data.jobId, 3);
    expect(deadLetter.moveToDeadLetter).toHaveBeenCalled();
    expect(repository.markDeadLetter).toHaveBeenCalledWith(
      job.data.jobId,
      'fatal',
    );
    expect(repository.markRetrying).not.toHaveBeenCalled();
  });

  it('skips terminal completed jobs without status mutations', async () => {
    repository.findById.mockResolvedValue(
      makeRecord({ status: JobStatus.Completed }),
    );

    const result = await processor.process(makeBullJob());

    expect(result).toEqual({
      skipped: true,
      status: JobStatus.Completed,
    });
    expect(repository.markProcessing).not.toHaveBeenCalled();
  });

  it('throws UnrecoverableError when DB record is missing', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(processor.process(makeBullJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('throws UnrecoverableError for cancelled jobs', async () => {
    repository.findById.mockResolvedValue(
      makeRecord({ status: JobStatus.Cancelled }),
    );

    await expect(processor.process(makeBullJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(repository.markProcessing).not.toHaveBeenCalled();
  });
});
