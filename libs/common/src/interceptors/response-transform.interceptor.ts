import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { ApiResponseDto, successResponse } from '../dto/api-response.dto';

/**
 * Wraps every successful controller return value as:
 * { message: "Successful", statusCode, data }
 */
@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (this.isAlreadyWrapped(data)) {
          return data;
        }

        const statusCode = response.statusCode || 200;
        return successResponse(data ?? null, statusCode);
      }),
    );
  }

  private isAlreadyWrapped(data: unknown): data is ApiResponseDto {
    return (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      'statusCode' in data &&
      'data' in data
    );
  }
}
