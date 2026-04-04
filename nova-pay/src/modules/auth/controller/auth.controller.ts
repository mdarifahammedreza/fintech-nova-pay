import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { LoginHandler } from '../command/handlers/login.handler';
import { RegisterHandler } from '../command/handlers/register.handler';
import { ValidateSessionHandler } from '../query/handlers/validate-session.handler';
import { LoginCommand } from '../command/impl/login.command';
import { RegisterCommand } from '../command/impl/register.command';
import { ValidateSessionQuery } from '../query/impl/validate-session.query';
import { AccessJwtPayload } from '../service/token.service';

/** Token pair returned after login/register. */
export class AuthTokensResponseDto {
  @ApiProperty({ description: 'JWT access token (identity / roles only)' })
  accessToken: string;

  @ApiProperty({ description: 'Opaque refresh token; store hash server-side' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token lifetime in seconds' })
  expiresIn: number;
}

/** Verified access-token claims (no password or refresh material). */
export class SessionClaimsResponseDto {
  @ApiProperty({ format: 'uuid' })
  sub: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: string;
}

function parseBearer(authorization?: string): string {
  const v = authorization?.trim();
  if (!v) {
    return '';
  }
  const m = /^Bearer\s+(.+)$/i.exec(v);
  return m?.[1]?.trim() ?? '';
}

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(
    private readonly loginHandler: LoginHandler,
    private readonly registerHandler: RegisterHandler,
    private readonly validateSessionHandler: ValidateSessionHandler,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create account and issue tokens' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthTokensResponseDto> {
    return this.registerHandler.execute(new RegisterCommand(dto));
  }

  @Post('login')
  @ApiOperation({ summary: 'Login and issue tokens' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthTokensResponseDto> {
    return this.loginHandler.execute(new LoginCommand(dto));
  }

  @Get('session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate access token and return claims' })
  @ApiOkResponse({ type: SessionClaimsResponseDto })
  async validateSession(
    @Headers('authorization') authorization?: string,
  ): Promise<SessionClaimsResponseDto> {
    const token = parseBearer(authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization Bearer token required');
    }
    try {
      const claims = await this.validateSessionHandler.execute(
        new ValidateSessionQuery(token),
      );
      return toSessionResponse(claims);
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

function toSessionResponse(claims: AccessJwtPayload): SessionClaimsResponseDto {
  return { sub: claims.sub, email: claims.email, role: claims.role };
}
