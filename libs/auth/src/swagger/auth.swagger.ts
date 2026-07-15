import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiWrappedErrorResponses, ApiWrappedOkResponse } from '@app/common';
import { LoginResponseDto } from '../dto/login.dto';

export function ApiAuthController() {
  return applyDecorators(ApiTags('auth'));
}

export function ApiLogin() {
  return applyDecorators(
    ApiOperation({ summary: 'Login and receive a JWT access token' }),
    ApiWrappedOkResponse(LoginResponseDto),
    ApiWrappedErrorResponses(),
  );
}
