import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { JOBS_DLQ, JOBS_QUEUE } from './constants';
import { JobProducer } from './job.producer';
import { QueueControlService } from './queue-control.service';

/**
 * Shared queue wiring for API (produce + ops) and as a base for the worker.
 * Processors are registered only in QueueWorkerModule.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue({ name: JOBS_QUEUE }),
    BullModule.registerQueue({ name: JOBS_DLQ }),
  ],
  providers: [JobProducer, QueueControlService],
  exports: [BullModule, JobProducer, QueueControlService],
})
export class QueueModule {}
