import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthSessionRepository } from '../repositories/auth-session.repository';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UserRole } from '../../users/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/service/users.service';
import { AccessJwtPayload, TokenService } from './token.service';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

/**
 * Auth orchestration: users via {@link UsersService} only; refresh rows via
 * {@link AuthSessionRepository}. JWTs are not financial controls.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: AuthSessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const create: CreateUserDto = {
      fullName: dto.fullName,
      email: dto.email,
      password: dto.password,
      role: UserRole.USER,
      isActive: true,
    };
    const user = await this.users.createUser(create);
    return this.issueTokensForUser(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.users.getUserByEmail(dto.email);
    if (!user?.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!verifyScryptPassword(dto.password, user.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokensForUser(user);
  }

  issueAccessTokenForUser(user: User): string {
    return this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async issueRefreshTokenForUser(user: User): Promise<string> {
    const raw = this.tokens.generateRefreshTokenValue();
    const tokenHash = this.tokens.hashRefreshTokenForStorage(raw);
    await this.sessions.persistSession({
      userId: user.id,
      tokenHash,
      expiresAt: this.tokens.getRefreshExpiresAt(),
      revokedAt: null,
    });
    return raw;
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const hash = this.tokens.hashRefreshTokenForStorage(dto.refreshToken);
    const session = await this.sessions.findActiveByTokenHash(hash);
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.requireUserById(session.userId);
    if (!user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.sessions.revokeById(session.id);
    return this.issueTokensForUser(user);
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    const hash = this.tokens.hashRefreshTokenForStorage(dto.refreshToken);
    const session = await this.sessions.findActiveByTokenHash(hash);
    if (session) {
      await this.sessions.revokeById(session.id);
    }
  }

  /** Verifies access JWT (identity claims only). */
  validateAccessToken(token: string): Promise<AccessJwtPayload> {
    return this.tokens.verifyAccessToken(token);
  }

  private async issueTokensForUser(user: User): Promise<AuthTokens> {
    const accessToken = this.issueAccessTokenForUser(user);
    const refreshToken = await this.issueRefreshTokenForUser(user);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.tokens.getAccessExpiresInSeconds(),
    };
  }
}

/** Matches `UsersService` password format (`scrypt$hexSalt$hexDerived`). */
function verifyScryptPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = scryptSync(plain, salt, expected.length);
    return (
      expected.length === derived.length &&
      timingSafeEqual(expected, derived)
    );
  } catch {
    return false;
  }
}
