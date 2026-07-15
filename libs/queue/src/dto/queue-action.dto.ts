import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class QueueActionRequestDto {
  @ApiPropertyOptional({
    example: 'Scheduled maintenance',
    description: 'Optional reason for pausing or resuming the queue',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QueueStatusDto {
  @ApiProperty({ example: false })
  paused!: boolean;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: {
      waiting: 0,
      active: 0,
      completed: 1,
      failed: 0,
      delayed: 0,
      paused: 0,
    },
  })
  counts!: Record<string, number>;
}

export class QueueActionResponseDto {
  @ApiProperty({ example: 'paused', enum: ['paused', 'resumed'] })
  status!: string;

  @ApiPropertyOptional({
    example: 'Scheduled maintenance',
    nullable: true,
  })
  reason!: string | null;
}
