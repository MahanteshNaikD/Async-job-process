import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiWrappedCreatedResponse,
  ApiWrappedErrorResponses,
  ApiWrappedOkResponse,
} from '@app/common';
import { JobResponseDto, PaginatedJobsResponseDto } from '@app/jobs';

export function ApiJobsController() {
  return applyDecorators(ApiTags('jobs'), ApiBearerAuth());
}

export function ApiCreateJob() {
  return applyDecorators(
    ApiOperation({ summary: 'Submit a background job' }),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Optional. Prefer over body.idempotencyKey when both present',
    }),
    ApiWrappedCreatedResponse(JobResponseDto, 'Job created and enqueued'),
    ApiWrappedOkResponse(JobResponseDto, 'Idempotent replay of an existing job'),
    ApiWrappedErrorResponses(),
  );
}

export function ApiListJobs() {
  return applyDecorators(
    ApiOperation({ summary: 'List jobs with filtering and pagination' }),
    ApiWrappedOkResponse(PaginatedJobsResponseDto),
    ApiWrappedErrorResponses(),
  );
}

export function ApiGetJob() {
  return applyDecorators(
    ApiOperation({ summary: 'Get job by id' }),
    ApiWrappedOkResponse(JobResponseDto),
    ApiWrappedErrorResponses(),
  );
}

export function ApiCancelJob() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cancel a queued / delayed / retrying job',
      description:
        'Sets status to cancelled and removes the job from BullMQ. Cannot cancel jobs that are processing or already finished.',
    }),
    ApiWrappedOkResponse(JobResponseDto, 'Job cancelled'),
    ApiResponse({
      status: 409,
      description: 'Job cannot be cancelled (e.g. already processing)',
    }),
    ApiWrappedErrorResponses(),
  );
}
