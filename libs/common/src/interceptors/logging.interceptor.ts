import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Ensures correlation + request IDs and emits structured access logs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = Date.now();

    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ??
      randomUUID();
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    request.headers['x-correlation-id'] = correlationId;
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-correlation-id', correlationId);
    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log({
            msg: 'request_completed',
            step: 'http_request_completed',
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - started,
            correlationId,
            requestId,
          });
        },
        error: (error: unknown) => {
          this.logger.error({
            msg: 'request_failed',
            step: 'http_request_failed',
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - started,
            correlationId,
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      }),
    );
  }
}
