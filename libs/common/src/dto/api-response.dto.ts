import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Uniform API envelope for every HTTP response.
 *
 * { message: "Successful" | "<error>", statusCode: 200, data: {} }
 */
export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: 'Successful' })
  message!: string;

  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiPropertyOptional({
    description: 'Payload for success, or error details when failed',
    nullable: true,
  })
  data!: T | null;
}

export function successResponse<T>(
  data: T,
  statusCode: number,
  message = 'Successful',
): ApiResponseDto<T> {
  return { message, statusCode, data };
}

export function errorResponse(
  message: string,
  statusCode: number,
  data: unknown = null,
): ApiResponseDto<unknown> {
  return { message, statusCode, data };
}
