import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CreateJobDto,
  JobResponseDto,
  JobsService,
  ListJobsQueryDto,
  PaginatedJobsResponseDto,
} from '@app/jobs';
import {
  ApiCancelJob,
  ApiCreateJob,
  ApiGetJob,
  ApiJobsController,
  ApiListJobs,
} from './swagger/jobs.swagger';

@ApiJobsController()
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiCreateJob()
  async create(
    @Body() dto: CreateJobDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JobResponseDto> {
    const result = await this.jobsService.create(dto, idempotencyKey);
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.job;
  }

  @Get()
  @ApiListJobs()
  list(@Query() query: ListJobsQueryDto): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.list(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiGetJob()
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<JobResponseDto> {
    return this.jobsService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCancelJob()
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<JobResponseDto> {
    return this.jobsService.cancel(id);
  }
}
