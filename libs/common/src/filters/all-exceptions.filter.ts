import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { errorResponse } from '../dto/api-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, data } = this.extractError(exception);

    if (statusCode >= 500) {
      this.logger.error(
        {
          path: request.url,
          method: request.method,
          correlationId: request.headers['x-correlation-id'],
        },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json(errorResponse(message, statusCode, data));
  }

  private extractError(exception: unknown): {
    message: string;
    data: unknown;
  } {
    if (!(exception instanceof HttpException)) {
      return {
        message: 'Internal server error',
        data: null,
      };
    }

    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { message: body, data: null };
    }

    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      const rawMessage = record.message;

      if (Array.isArray(rawMessage)) {
        return {
          message: 'Validation failed',
          data: { errors: rawMessage },
        };
      }

      if (typeof rawMessage === 'string') {
        const { message: _m, statusCode: _s, error: _e, ...rest } = record;
        return {
          message: rawMessage,
          data: Object.keys(rest).length > 0 ? rest : null,
        };
      }

      return {
        message: exception.message || 'Request failed',
        data: record,
      };
    }

    return {
      message: exception.message || 'Request failed',
      data: null,
    };
  }
}
