import { JobStatus } from './enums/job-status.enum';
import { JobsRepository } from './jobs.repository';
import { Job } from './models/job.model';

describe('JobsRepository — status updates', () => {
  let repository: JobsRepository;
  let jobModel: {
    update: jest.Mock;
  };

  beforeEach(() => {
    jobModel = {
      update: jest.fn().mockResolvedValue([1]),
    };
    repository = new JobsRepository(jobModel as unknown as typeof Job);
  });

  it('markProcessing sets processing status, attempts, startedAt', async () => {
    await repository.markProcessing('job-1', 2);

    expect(jobModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.Processing,
        attempts: 2,
        lastError: null,
        startedAt: expect.any(Date),
      }),
      { where: { id: 'job-1' } },
    );
  });

  it('markCompleted sets completed status and completedAt', async () => {
    await repository.markCompleted('job-1');

    expect(jobModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.Completed,
        lastError: null,
        completedAt: expect.any(Date),
      }),
      { where: { id: 'job-1' } },
    );
  });

  it('markRetrying sets retrying status and lastError', async () => {
    await repository.markRetrying('job-1', 'temporary failure');

    expect(jobModel.update).toHaveBeenCalledWith(
      {
        status: JobStatus.Retrying,
        lastError: 'temporary failure',
      },
      { where: { id: 'job-1' } },
    );
  });

  it('markDeadLetter sets dead_letter status, error, and completedAt', async () => {
    await repository.markDeadLetter('job-1', 'fatal');

    expect(jobModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.DeadLetter,
        lastError: 'fatal',
        completedAt: expect.any(Date),
      }),
      { where: { id: 'job-1' } },
    );
  });

  it('truncates long error messages when marking enqueue failure', async () => {
    const long = 'x'.repeat(3000);
    await repository.markEnqueueFailed('job-1', long);

    expect(jobModel.update).toHaveBeenCalledWith(
      { lastError: long.slice(0, 2000) },
      { where: { id: 'job-1' } },
    );
  });
});
