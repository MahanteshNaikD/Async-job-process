import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { JwtPayload } from './decorators';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    this.logger.log({ step: 'login_attempt', username: dto.username });

    const expectedUser = this.config.get<string>('auth.username');
    const expectedPass = this.config.get<string>('auth.password');
    const expiresIn = this.config.get<string>('auth.jwtExpiresIn') ?? '1d';

    if (dto.username !== expectedUser || dto.password !== expectedPass) {
      this.logger.warn({ step: 'login_failed', username: dto.username });
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload: JwtPayload = {
      sub: dto.username,
      username: dto.username,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    this.logger.log({ step: 'login_ok', username: dto.username, expiresIn });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }
}
