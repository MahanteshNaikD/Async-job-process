import { join } from 'path';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { createFileLogger } from '@app/common';
import { ApiModule } from './api.module';
import { buildSwaggerConfig } from './swagger/document.config';

async function bootstrap() {
  const fileLogger = createFileLogger({
    app: 'api',
    dir: process.env.LOG_DIR ?? join(process.cwd(), 'logs'),
  });
  const logger = new Logger('API');
  const app = await NestFactory.create<NestExpressApplication>(ApiModule, {
    logger: fileLogger,
  });

  const webRoot = join(process.cwd(), 'web');
  app.useStaticAssets(webRoot, { index: false });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  // SPA shell for the operations console
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/', (_req: unknown, res: { sendFile: (path: string) => void }) => {
    res.sendFile(join(webRoot, 'index.html'));
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('api.port') ?? 3000;

  await app.listen(port);
  logger.log({
    step: 'api_started',
    port,
    logFile: fileLogger.path,
    console: 'http://localhost:' + port,
    docs: `http://localhost:${port}/docs`,
  });
}

void bootstrap();
