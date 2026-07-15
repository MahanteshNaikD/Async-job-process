import { Module } from '@nestjs/common';
import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { QueueWorkerModule } from '@app/queue/queue-worker.module';

/**
 * Worker process — no HTTP controllers.
 * QueueWorkerModule registers BullMQ JobProcessor + handlers.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, QueueWorkerModule],
})
export class WorkerModule {}
