import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { Job } from '@app/jobs/models/job.model';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('nodeEnv') === 'production';
        const syncEnabled = config.get<string>('database.sync') === 'true';

        return {
          dialect: 'postgres' as const,
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.name'),
          models: [Job],
          autoLoadModels: true,
          // NEVER alter in production. Prefer migrations (npm run db:migrate).
          synchronize: !isProd && syncEnabled,
          logging: isProd ? false : console.log,
          define: {
            underscored: true,
          },
        };
      },
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
