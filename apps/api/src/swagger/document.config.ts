import { DocumentBuilder } from '@nestjs/swagger';

export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Async Job Process API')
    .setDescription(
      'Scalable asynchronous job processing platform built with NestJS, BullMQ, PostgreSQL, and Redis.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
