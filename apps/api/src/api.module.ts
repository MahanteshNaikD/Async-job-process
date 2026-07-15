import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@app/auth';
import { AppConfigModule } from '@app/config';
import { CommonModule } from '@app/common';
import { DatabaseModule } from '@app/database';
import { JobsModule } from '@app/jobs';
import { QueueModule } from '@app/queue';
import { HealthModule } from '@app/health';
import { MetricsModule } from '@app/metrics';
import { JobsController } from './jobs.controller';
import { QueueController } from './queue.controller';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttlMs') ?? 60_000,
          limit: config.get<number>('throttle.limit') ?? 100,
        },
      ],
    }),
    DatabaseModule,
    JobsModule,
    QueueModule,
    HealthModule,
    MetricsModule,
  ],
  controllers: [JobsController, QueueController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class ApiModule {}
