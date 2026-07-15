import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  Index,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { JobStatus } from '../enums/job-status.enum';

export type JobPayload = Record<string, unknown>;

@Table({
  tableName: 'jobs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'jobs_status_created_at_idx',
      fields: ['status', { name: 'created_at', order: 'DESC' }],
    },
    {
      name: 'jobs_status_available_at_idx',
      fields: ['status', 'available_at'],
    },
    {
      name: 'jobs_type_status_idx',
      fields: ['type', 'status'],
    },
    {
      name: 'jobs_active_partial_idx',
      fields: ['status', 'available_at'],
      where: {
        status: [
          JobStatus.Queued,
          JobStatus.Processing,
          JobStatus.Retrying,
          JobStatus.Delayed,
        ],
      },
    },
  ],
})
export class Job extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(true)
  @Index({ name: 'jobs_idempotency_key_uidx', unique: true })
  @Column(DataType.STRING)
  declare idempotencyKey: string | null;

  @AllowNull(false)
  @Column(DataType.STRING(128))
  declare type: string;

  @AllowNull(false)
  @Default({})
  @Column(DataType.JSONB)
  declare payload: JobPayload;

  @AllowNull(false)
  @Default(JobStatus.Queued)
  @Column(DataType.ENUM(...Object.values(JobStatus)))
  declare status: JobStatus;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare priority: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare attempts: number;

  @AllowNull(false)
  @Default(3)
  @Column(DataType.INTEGER)
  declare maxAttempts: number;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare availableAt: Date;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare lastError: string | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare startedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare completedAt: Date | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
