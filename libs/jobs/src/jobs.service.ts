import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { JobProducer } from '@app/queue/job.producer';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import {
  JobResponseDto,
  PaginatedJobsResponseDto,
} from './dto/job-response.dto';
import { JobStatus } from './enums/job-status.enum';
import { JobsRepository } from './jobs.repository';
import { Job } from './models/job.model';

export interface CreateJobResult {
  job: JobResponseDto;
  created: boolean;
}

/** Statuses that may be cancelled (not yet actively executing). */
const CANCELLABLE_STATUSES: JobStatus[] = [
  JobStatus.Queued,
  JobStatus.Delayed,
  JobStatus.Retrying,
];

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly jobProducer: JobProducer,
  ) {}

  async create(
    dto: CreateJobDto,
    idempotencyKeyFromHeader?: string,
  ): Promise<CreateJobResult> {
    const idempotencyKey =
      idempotencyKeyFromHeader?.trim() || dto.idempotencyKey?.trim() || null;

    this.logger.log({
      step: 'create_job_received',
      type: dto.type,
      priority: dto.priority ?? 0,
      maxAttempts: dto.maxAttempts ?? 3,
      hasDelayMs: dto.delayMs != null,
      hasRunAt: Boolean(dto.runAt),
      hasIdempotencyKey: Boolean(idempotencyKey),
    });

    if (idempotencyKey) {
      this.logger.log({ step: 'idempotency_lookup', idempotencyKey });
      const existing =
        await this.jobsRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        this.logger.log({
          step: 'idempotent_replay',
          jobId: existing.id,
          idempotencyKey,
          status: existing.status,
        });
        return { job: JobResponseDto.fromEntity(existing), created: false };
      }
    }

    const { delayMs, availableAt } = this.resolveSchedule(dto);
    const status = delayMs > 0 ? JobStatus.Delayed : JobStatus.Queued;

    this.logger.log({
      step: 'schedule_resolved',
      delayMs,
      availableAt: availableAt.toISOString(),
      status,
    });

    let job: Job;
    try {
      this.logger.log({ step: 'persist_job_start', type: dto.type, status });
      job = await this.jobsRepository.create({
        type: dto.type,
        payload: dto.payload,
        priority: dto.priority ?? 0,
        maxAttempts: dto.maxAttempts ?? 3,
        availableAt,
        idempotencyKey,
        status,
      });
      this.logger.log({
        step: 'persist_job_ok',
        jobId: job.id,
        status: job.status,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError && idempotencyKey) {
        const existing =
          await this.jobsRepository.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          this.logger.log({
            step: 'idempotent_replay_race',
            jobId: existing.id,
            idempotencyKey,
          });
          return { job: JobResponseDto.fromEntity(existing), created: false };
        }
        throw new ConflictException('Idempotency key conflict');
      }
      throw error;
    }

    try {
      this.logger.log({
        step: 'enqueue_start',
        jobId: job.id,
        type: job.type,
        delayMs,
        priority: job.priority,
      });
      await this.jobProducer.enqueue({
        id: job.id,
        type: job.type,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
        delayMs,
        payload: job.payload,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown enqueue error';
      await this.jobsRepository.markEnqueueFailed(
        job.id,
        `enqueue_failed: ${message}`,
      );
      this.logger.error({
        step: 'enqueue_failed',
        jobId: job.id,
        error: message,
      });
      throw new ServiceUnavailableException(
        'Job was saved but could not be enqueued. Retry later.',
      );
    }

    this.logger.log({
      step: 'create_job_done',
      jobId: job.id,
      type: job.type,
      status: job.status,
      delayMs,
      availableAt: availableAt.toISOString(),
    });

    return { job: JobResponseDto.fromEntity(job), created: true };
  }

  /**
   * Supports either relative `delayMs` or absolute `runAt` (not both).
   */
  private resolveSchedule(dto: CreateJobDto): {
    delayMs: number;
    availableAt: Date;
  } {
    const hasRunAt = dto.runAt !== undefined && dto.runAt !== null && dto.runAt !== '';
    const hasDelayMs = dto.delayMs !== undefined && dto.delayMs !== null;

    if (hasRunAt && hasDelayMs) {
      throw new BadRequestException(
        'Provide either runAt or delayMs, not both',
      );
    }

    if (hasRunAt) {
      const runAt = new Date(dto.runAt as string);
      if (Number.isNaN(runAt.getTime())) {
        throw new BadRequestException('runAt must be a valid ISO-8601 datetime');
      }
      const delayMs = runAt.getTime() - Date.now();
      if (delayMs < 0) {
        throw new BadRequestException('runAt must be in the future');
      }
      return { delayMs, availableAt: runAt };
    }

    const delayMs = dto.delayMs ?? 0;
    return {
      delayMs,
      availableAt: new Date(Date.now() + delayMs),
    };
  }

  async findById(id: string): Promise<JobResponseDto> {
    this.logger.log({ step: 'get_job', jobId: id });
    const job = await this.jobsRepository.findById(id);
    if (!job) {
      this.logger.warn({ step: 'get_job_not_found', jobId: id });
      throw new NotFoundException(`Job ${id} not found`);
    }
    return JobResponseDto.fromEntity(job);
  }

  async list(query: ListJobsQueryDto): Promise<PaginatedJobsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    this.logger.log({
      step: 'list_jobs',
      page,
      limit,
      status: query.status ?? null,
      type: query.type ?? null,
      sortBy,
      sortOrder,
    });

    const { rows, count } = await this.jobsRepository.findMany({
      status: query.status,
      type: query.type,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return {
      data: rows.map((job) => JobResponseDto.fromEntity(job)),
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit) || 0,
      },
    };
  }

  /**
   * Cancel a waiting job (queued / delayed / retrying).
   * Rejects jobs already processing or in a terminal state.
   */
  async cancel(id: string): Promise<JobResponseDto> {
    this.logger.log({ step: 'cancel_job_received', jobId: id });

    const existing = await this.jobsRepository.findById(id);
    if (!existing) {
      this.logger.warn({ step: 'cancel_job_not_found', jobId: id });
      throw new NotFoundException(`Job ${id} not found`);
    }

    if (existing.status === JobStatus.Cancelled) {
      this.logger.log({ step: 'cancel_job_already_cancelled', jobId: id });
      return JobResponseDto.fromEntity(existing);
    }

    if (existing.status === JobStatus.Processing) {
      this.logger.warn({
        step: 'cancel_job_rejected_processing',
        jobId: id,
        status: existing.status,
      });
      throw new ConflictException(
        'Cannot cancel a job that is already processing',
      );
    }

    if (!CANCELLABLE_STATUSES.includes(existing.status)) {
      this.logger.warn({
        step: 'cancel_job_rejected_status',
        jobId: id,
        status: existing.status,
      });
      throw new ConflictException(
        `Cannot cancel job in status "${existing.status}"`,
      );
    }

    const cancelled = await this.jobsRepository.markCancelled(
      id,
      CANCELLABLE_STATUSES,
    );

    if (!cancelled) {
      // Race: moved to processing between read and update
      const latest = await this.jobsRepository.findById(id);
      this.logger.warn({
        step: 'cancel_job_race',
        jobId: id,
        status: latest?.status,
      });
      throw new ConflictException(
        latest?.status === JobStatus.Processing
          ? 'Cannot cancel a job that is already processing'
          : `Cannot cancel job in status "${latest?.status ?? 'unknown'}"`,
      );
    }

    try {
      await this.jobProducer.remove(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({
        step: 'cancel_queue_remove_failed',
        jobId: id,
        error: message,
      });
      // DB is already cancelled; worker will skip if the job is claimed.
    }

    this.logger.log({
      step: 'cancel_job_done',
      jobId: id,
      previousStatus: existing.status,
    });

    return JobResponseDto.fromEntity(cancelled);
  }
}
