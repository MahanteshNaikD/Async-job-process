import { applyDecorators, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiWrappedErrorResponses,
  ApiWrappedOkResponse,
} from '@app/common';
import {
  JobsService,
  ListDeadLetterJobsQueryDto,
  PaginatedJobsResponseDto,
} from '@app/jobs';

function ApiDeadLetterJobsController() {
  return applyDecorators(ApiTags('dead-letter-jobs'), ApiBearerAuth());
}

function ApiListDeadLetterJobs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List dead-letter jobs',
      description:
        'Returns jobs that exhausted retries (status=dead_letter). Source of truth is PostgreSQL.',
    }),
    ApiWrappedOkResponse(PaginatedJobsResponseDto),
    ApiWrappedErrorResponses(),
  );
}

@ApiDeadLetterJobsController()
@Controller({ path: 'dead-letter-jobs', version: '1' })
export class DeadLetterJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @ApiListDeadLetterJobs()
  list(
    @Query() query: ListDeadLetterJobsQueryDto,
  ): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.listDeadLetter(query);
  }
}
