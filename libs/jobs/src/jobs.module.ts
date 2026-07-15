import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { QueueModule } from '@app/queue';
import { Job } from './models/job.model';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';

@Module({
  imports: [SequelizeModule.forFeature([Job]), QueueModule],
  providers: [JobsRepository, JobsService],
  exports: [SequelizeModule, JobsRepository, JobsService],
})
export class JobsModule {}
