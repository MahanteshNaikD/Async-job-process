import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Swagger-only models for health/metrics wrapped `data` payloads. */
export class HealthStatusDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'api', required: false })
  service?: string;

  @ApiProperty({ example: '2026-07-14T12:00:00.000Z', required: false })
  timestamp?: string;

  @ApiProperty({ example: 'up', required: false })
  database?: string;
}

export class MetricsSnapshotDto {
  @ApiProperty({ example: 0 })
  queueLength!: number;

  @ApiProperty({ example: 0 })
  activeJobs!: number;

  @ApiProperty({ example: 0 })
  completedJobs!: number;

  @ApiProperty({ example: 0 })
  failedJobs!: number;

  @ApiProperty({ example: 0 })
  delayedJobs!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  queue!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  dlq!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { queued: 1, completed: 3, dead_letter: 1 },
  })
  jobsByStatus!: Record<string, number>;

  @ApiProperty()
  collectedAt!: string;

  @ApiPropertyOptional()
  note?: string;
}
