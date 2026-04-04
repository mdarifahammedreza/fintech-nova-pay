import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

/** Claims embedded in the access JWT (identity / authorization only). */
export type AccessJwtPayload = {
  sub: string;
  email: string;
  role: string;
};

/**
 * Token primitives: access JWT signing/verification and refresh opaque-token
 * hashing. No user loading or session persistence here.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessJwtPayload): string {
    const expiresIn = this.getAccessExpiresInSeconds();
    return this.jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AccessJwtPayload> {
    const body = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
    const sub = body.sub;
    const email = body.email;
    const role = body.role;
    if (typeof sub !== 'string' || typeof email !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }
    return {
      sub,
      email,
      role: typeof role === 'string' ? role : '',
    };
  }

  /** Seconds until access token expiry (for API metadata). */
  getAccessExpiresInSeconds(): number {
    const raw = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    return parseExpiresToSeconds(raw);
  }

  /** Opaque refresh token returned to the client (store only a hash). */
  generateRefreshTokenValue(): string {
    return randomBytes(32).toString('base64url');
  }

  /** SHA-256 hex digest for `RefreshToken.tokenHash` persistence. */
  hashRefreshTokenForStorage(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /** Absolute expiry for a new refresh session row. */
  getRefreshExpiresAt(): Date {
    const days = Number(
      this.config.get<string>('JWT_REFRESH_EXPIRES_DAYS', '7'),
    );
    const safe =
      Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 365) : 7;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + safe);
    return d;
  }
}

function parseExpiresToSeconds(raw: string): number {
  const t = raw.trim();
  const m = t.match(/^(\d+)(s|m|h|d)?$/i);
  if (!m) {
    return 900;
  }
  const n = parseInt(m[1], 10);
  const u = (m[2] ?? 's').toLowerCase();
  const mult =
    u === 'm' ? 60 : u === 'h' ? 3600 : u === 'd' ? 86400 : 1;
  return n * mult;
}
