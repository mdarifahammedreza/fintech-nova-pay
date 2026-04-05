import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/** Claims attached to `request.user` after successful Bearer verification. */
export type JwtRequestUser = {
  sub: string;
  email: string;
  role: string;
};

function parseBearer(authorization?: string): string {
  const v = authorization?.trim();
  if (!v) {
    return '';
  }
  const m = /^Bearer\s+(.+)$/i.exec(v);
  return m?.[1]?.trim() ?? '';
}

/**
 * Requires `Authorization: Bearer <access JWT>`. Claim checks mirror
 * auth `TokenService.verifyAccessToken` (same secret and `sub` / `email` / `role`).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: JwtRequestUser }
    >();
    const token = parseBearer(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Authorization Bearer token required');
    }
    try {
      const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
      const body = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret,
      });
      const sub = body.sub;
      const email = body.email;
      const role = body.role;
      if (typeof sub !== 'string' || typeof email !== 'string') {
        throw new UnauthorizedException('Invalid access token');
      }
      req.user = {
        sub,
        email,
        role: typeof role === 'string' ? role : '',
      };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
