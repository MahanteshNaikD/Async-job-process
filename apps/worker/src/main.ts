import { join } from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createFileLogger } from '@app/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const fileLogger = createFileLogger({
    app: 'worker',
    dir: process.env.LOG_DIR ?? join(process.cwd(), 'logs'),
  });
  const logger = new Logger('Worker');

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: fileLogger,
  });

  // Finish in-flight jobs on SIGTERM/SIGINT before exit.
  app.enableShutdownHooks();

  const shutdown = async (signal: string) => {
    logger.log({ step: 'worker_shutdown', signal });
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.log({
    step: 'worker_started',
    logFile: fileLogger.path,
    message: 'Worker ready — consuming BullMQ jobs',
  });
}

void bootstrap();
