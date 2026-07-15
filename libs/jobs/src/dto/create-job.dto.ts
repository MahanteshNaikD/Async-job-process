import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJobDto {
  @ApiProperty({ example: 'email.send', maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  type!: string;

  @ApiProperty({
    example: { to: 'user@example.com', template: 'welcome' },
    description: 'Opaque JSON payload for the worker handler',
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 10,
    description: 'Higher number = more urgent (mapped for BullMQ internally)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  priority?: number;

  @ApiPropertyOptional({ example: 3, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  maxAttempts?: number;

  @ApiPropertyOptional({
    example: 5000,
    description:
      'Relative delay from now in milliseconds. Use this OR runAt, not both.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delayMs?: number;

  @ApiPropertyOptional({
    example: '2026-07-20T10:30:00.000Z',
    description:
      'Absolute UTC ISO-8601 time to run the job. Use this OR delayMs, not both.',
  })
  @IsOptional()
  @IsDateString()
  runAt?: string;

  @ApiPropertyOptional({
    example: 'client-request-abc-123',
    description: 'Also accepted via Idempotency-Key header',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
