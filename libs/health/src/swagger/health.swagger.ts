import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiWrappedErrorResponses,
  ApiWrappedOkResponse,
  HealthStatusDto,
} from '@app/common';

export function ApiHealthController() {
  return applyDecorators(ApiTags('health'));
}

export function ApiHealthCheck() {
  return applyDecorators(
    ApiOperation({ summary: 'Liveness/health check' }),
    ApiWrappedOkResponse(HealthStatusDto),
  );
}

export function ApiHealthLive() {
  return applyDecorators(
    ApiOperation({ summary: 'Process liveness' }),
    ApiWrappedOkResponse(HealthStatusDto),
  );
}

export function ApiHealthReady() {
  return applyDecorators(
    ApiOperation({ summary: 'Readiness (database connectivity)' }),
    ApiWrappedOkResponse(HealthStatusDto),
    ApiWrappedErrorResponses(),
  );
}
