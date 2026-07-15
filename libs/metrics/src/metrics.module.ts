import { Module } from '@nestjs/common';
import { JobsModule } from '@app/jobs';
import { QueueModule } from '@app/queue';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [QueueModule, JobsModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
