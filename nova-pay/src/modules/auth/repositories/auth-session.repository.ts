import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, IsNull, MoreThan, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { RefreshToken } from '../entities/refresh-token.entity';

@Injectable()
export class AuthSessionRepository extends BaseRepository<RefreshToken> {
  constructor(
    @InjectRepository(RefreshToken)
    repository: Repository<RefreshToken>,
  ) {
    super(repository);
  }

  persistSession(row: DeepPartial<RefreshToken>): Promise<RefreshToken> {
    return this.save(row);
  }

  findById(id: string): Promise<RefreshToken | null> {
    return this.findOneBy({ id });
  }

  /**
   * Lookup by hash for rotation/validation (not revoked, not expired).
   */
  findActiveByTokenHash(hash: string): Promise<RefreshToken | null> {
    return this.findOne({
      where: {
        tokenHash: hash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    return this.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async revokeById(id: string): Promise<void> {
    await this.update({ id }, { revokedAt: new Date() });
  }

  async revokeAllActiveForUser(userId: string): Promise<void> {
    await this.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
