import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Relies on DatabaseModule being imported by the host app (API)
 * so Sequelize connection injection works for readiness.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
