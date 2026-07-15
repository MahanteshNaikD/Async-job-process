import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Query for GET /dead-letter-jobs (status is always dead_letter). */
export class ListDeadLetterJobsQueryDto {
  @ApiPropertyOptional({ example: 'demo.fail' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  type?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: ['createdAt', 'completedAt', 'priority'],
    default: 'completedAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'completedAt', 'priority'])
  sortBy?: 'createdAt' | 'completedAt' | 'priority' = 'completedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
