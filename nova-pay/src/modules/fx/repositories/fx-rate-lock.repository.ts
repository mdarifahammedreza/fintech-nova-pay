import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { FxRateLock } from '../entities/fx-rate-lock.entity';
import { FxLockStatus } from '../enums/fx-lock-status.enum';

/** `fx_rate_locks` persistence. */
@Injectable()
export class FxRateLockRepository extends BaseRepository<FxRateLock> {
  constructor(
    @InjectRepository(FxRateLock)
    repository: Repository<FxRateLock>,
  ) {
    super(repository);
  }

  /**
   * Row is ACTIVE and not past expires_at (caller clock; use DB time in TX if
   * required).
   */
  findValidLockById(id: string, asOf: Date = new Date()): Promise<FxRateLock | null> {
    return this.findOne({
      where: {
        id,
        status: FxLockStatus.ACTIVE,
        expiresAt: MoreThan(asOf),
      },
    });
  }

  findByIdAndUserId(id: string, userId: string): Promise<FxRateLock | null> {
    return this.findOneBy({ id, userId });
  }

  /**
   * SELECT … FOR UPDATE on the lock row. Must run inside an active query
   * runner transaction.
   */
  lockRateLockRowForUpdate(id: string): Promise<FxRateLock | null> {
    return this.repository
      .createQueryBuilder('lock')
      .where('lock.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
  }
}
