import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Public } from '@app/auth';
import {
  ApiHealthCheck,
  ApiHealthController,
  ApiHealthLive,
  ApiHealthReady,
} from './swagger/health.swagger';

@ApiHealthController()
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
  ) {}

  @Public()
  @Get()
  @ApiHealthCheck()
  check() {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('live')
  @ApiHealthLive()
  live() {
    return { status: 'alive' };
  }

  @Public()
  @Get('ready')
  @ApiHealthReady()
  async ready() {
    try {
      await this.sequelize.authenticate();
      return { status: 'ready', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Database is not ready',
        status: 'not_ready',
        database: 'down',
      });
    }
  }
}
