import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Job } from './models/job.model';
import { JobStatus } from './enums/job-status.enum';

export interface CreateJobRecordInput {
  type: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  availableAt?: Date;
  idempotencyKey?: string | null;
  status?: JobStatus;
}

export interface ListJobsInput {
  status?: JobStatus;
  type?: string;
  page: number;
  limit: number;
  sortBy: 'createdAt' | 'priority' | 'availableAt';
  sortOrder: 'asc' | 'desc';
}

/**
 * Persistence boundary for jobs.
 * Controllers/services talk to this — not Sequelize models directly.
 */
@Injectable()
export class JobsRepository {
  constructor(
    @InjectModel(Job)
    private readonly jobModel: typeof Job,
  ) {}

  async create(input: CreateJobRecordInput): Promise<Job> {
    return this.jobModel.create({
      type: input.type,
      payload: input.payload,
      priority: input.priority ?? 0,
      maxAttempts: input.maxAttempts ?? 3,
      availableAt: input.availableAt ?? new Date(),
      idempotencyKey: input.idempotencyKey ?? null,
      status: input.status ?? JobStatus.Queued,
    });
  }

  async findById(id: string): Promise<Job | null> {
    return this.jobModel.findByPk(id);
  }

  async findByIdempotencyKey(key: string): Promise<Job | null> {
    return this.jobModel.findOne({ where: { idempotencyKey: key } });
  }

  async findMany(input: ListJobsInput): Promise<{ rows: Job[]; count: number }> {
    const where: WhereOptions<Job> = {};

    if (input.status) {
      where.status = input.status;
    }
    if (input.type) {
      where.type = input.type;
    }

    const { rows, count } = await this.jobModel.findAndCountAll({
      where,
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
      // Use model attribute names; underscored maps to snake_case columns
      order: [[input.sortBy, input.sortOrder.toUpperCase()]],
    });

    return { rows, count };
  }

  async count(): Promise<number> {
    return this.jobModel.count();
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.jobModel.findAll({
      attributes: [
        'status',
        [this.jobModel.sequelize!.fn('COUNT', this.jobModel.sequelize!.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const result: Record<string, number> = {};
    for (const row of rows as unknown as Array<{ status: string; count: string }>) {
      result[row.status] = parseInt(String(row.count), 10);
    }
    return result;
  }

  async markEnqueueFailed(id: string, errorMessage: string): Promise<void> {
    await this.jobModel.update(
      {
        lastError: errorMessage.slice(0, 2000),
      },
      { where: { id } },
    );
  }

  async markProcessing(id: string, attempt: number): Promise<void> {
    await this.jobModel.update(
      {
        status: JobStatus.Processing,
        attempts: attempt,
        startedAt: new Date(),
        lastError: null,
      },
      { where: { id } },
    );
  }

  async markCompleted(id: string): Promise<void> {
    await this.jobModel.update(
      {
        status: JobStatus.Completed,
        completedAt: new Date(),
        lastError: null,
      },
      { where: { id } },
    );
  }

  async markRetrying(id: string, errorMessage: string): Promise<void> {
    await this.jobModel.update(
      {
        status: JobStatus.Retrying,
        lastError: errorMessage.slice(0, 2000),
      },
      { where: { id } },
    );
  }

  async markDeadLetter(id: string, errorMessage: string): Promise<void> {
    await this.jobModel.update(
      {
        status: JobStatus.DeadLetter,
        lastError: errorMessage.slice(0, 2000),
        completedAt: new Date(),
      },
      { where: { id } },
    );
  }

  /**
   * Conditionally sets status=cancelled only if current status is cancellable.
   * Returns the updated row, or null if the job was not in an allowed status
   * (e.g. already processing).
   */
  async markCancelled(
    id: string,
    allowedStatuses: JobStatus[],
  ): Promise<Job | null> {
    const [affected] = await this.jobModel.update(
      {
        status: JobStatus.Cancelled,
        completedAt: new Date(),
        lastError: null,
      },
      {
        where: {
          id,
          status: { [Op.in]: allowedStatuses },
        },
      },
    );

    if (affected === 0) {
      return null;
    }
    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    patch: Partial<
      Pick<Job, 'attempts' | 'lastError' | 'startedAt' | 'completedAt'>
    > = {},
  ): Promise<[affectedCount: number]> {
    return this.jobModel.update({ status, ...patch }, { where: { id } });
  }

  /** Used when recovering unique constraint races on idempotency key. */
  async findLatestByIdempotencyKey(key: string): Promise<Job | null> {
    return this.jobModel.findOne({
      where: { idempotencyKey: { [Op.eq]: key } },
      order: [['created_at', 'DESC']],
    });
  }
}
