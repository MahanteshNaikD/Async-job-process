import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/auth';
import { MetricsService } from './metrics.service';
import { ApiGetMetrics, ApiMetricsController } from './swagger/metrics.swagger';

@ApiMetricsController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @ApiGetMetrics()
  getMetrics() {
    return this.metricsService.snapshot();
  }
}
