import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

/**
 * Documents the uniform envelope in Swagger:
 * { message, statusCode, data: <model> }
 */
export function ApiWrappedOkResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Successful',
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['message', 'statusCode', 'data'],
        properties: {
          message: { type: 'string', example: 'Successful' },
          statusCode: { type: 'number', example: 200 },
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
}

export function ApiWrappedCreatedResponse<TModel extends Type<unknown>>(
  model: TModel,
  description = 'Successful',
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      description,
      schema: {
        type: 'object',
        required: ['message', 'statusCode', 'data'],
        properties: {
          message: { type: 'string', example: 'Successful' },
          statusCode: { type: 'number', example: 201 },
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
}

export function ApiWrappedErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Validation / bad request',
      schema: {
        type: 'object',
        required: ['message', 'statusCode', 'data'],
        properties: {
          message: { type: 'string', example: 'Validation failed' },
          statusCode: { type: 'number', example: 400 },
          data: {
            nullable: true,
            example: { errors: ['type should not be empty'] },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Not found',
      schema: {
        type: 'object',
        required: ['message', 'statusCode', 'data'],
        properties: {
          message: { type: 'string', example: 'Job <id> not found' },
          statusCode: { type: 'number', example: 404 },
          data: { nullable: true, example: null },
        },
      },
    }),
    ApiResponse({
      status: 503,
      description: 'Service unavailable (e.g. enqueue failed)',
      schema: {
        type: 'object',
        required: ['message', 'statusCode', 'data'],
        properties: {
          message: {
            type: 'string',
            example: 'Job was saved but could not be enqueued. Retry later.',
          },
          statusCode: { type: 'number', example: 503 },
          data: { nullable: true, example: null },
        },
      },
    }),
  );
}
