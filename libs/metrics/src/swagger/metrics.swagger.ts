import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiWrappedOkResponse, MetricsSnapshotDto } from '@app/common';

export function ApiMetricsController() {
  return applyDecorators(ApiTags('metrics'));
}

export function ApiGetMetrics() {
  return applyDecorators(
    ApiOperation({ summary: 'Queue / job metrics snapshot' }),
    ApiWrappedOkResponse(MetricsSnapshotDto),
  );
}
