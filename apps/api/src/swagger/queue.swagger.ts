import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiWrappedErrorResponses,
  ApiWrappedOkResponse,
} from '@app/common';
import {
  QueueActionRequestDto,
  QueueActionResponseDto,
  QueueStatusDto,
} from '@app/queue';

export function ApiQueueController() {
  return applyDecorators(ApiTags('queue'), ApiBearerAuth());
}

export function ApiQueueStatus() {
  return applyDecorators(
    ApiOperation({ summary: 'Queue pause state + BullMQ job counts' }),
    ApiWrappedOkResponse(QueueStatusDto),
  );
}

export function ApiPauseQueue() {
  return applyDecorators(
    ApiOperation({
      summary: 'Pause the jobs queue (workers stop claiming new jobs)',
    }),
    ApiBody({
      type: QueueActionRequestDto,
      required: true,
      description: 'Optional reason for the action (body may be `{}`)',
    }),
    ApiWrappedOkResponse(QueueActionResponseDto),
    ApiWrappedErrorResponses(),
  );
}

export function ApiResumeQueue() {
  return applyDecorators(
    ApiOperation({ summary: 'Resume the jobs queue' }),
    ApiBody({
      type: QueueActionRequestDto,
      required: true,
      description: 'Optional reason for the action (body may be `{}`)',
    }),
    ApiWrappedOkResponse(QueueActionResponseDto),
    ApiWrappedErrorResponses(),
  );
}
