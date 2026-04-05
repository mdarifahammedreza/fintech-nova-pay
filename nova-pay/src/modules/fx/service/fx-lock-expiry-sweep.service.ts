import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { FxRateLock } from '../entities/fx-rate-lock.entity';
import { FxLockStatus } from '../enums/fx-lock-status.enum';
import { FxRateLockExpiredEvent } from '../events/fx-rate-lock-expired.event';

/**
 * Marks overdue ACTIVE locks EXPIRED and enqueues `fx.rate.lock.expired` via
 * outbox in the same transaction. `SKIP LOCKED` lets multiple app instances
 * sweep disjoint rows safely.
 */
@Injectable()
export class FxLockExpirySweepService {
  private readonly logger = new Logger(FxLockExpirySweepService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxRepository,
  ) {}

  async sweepExpiredLocks(limit: number): Promise<number> {
    const cap = Math.max(1, Math.min(limit, 200));
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const candidates = await manager
        .createQueryBuilder(FxRateLock, 'l')
        .where('l.status = :active', { active: FxLockStatus.ACTIVE })
        .andWhere('l.expires_at <= :now', { now })
        .orderBy('l.expires_at', 'ASC')
        .take(cap)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      let n = 0;
      for (const lock of candidates) {
        if (lock.status !== FxLockStatus.ACTIVE || lock.expiresAt > now) {
          continue;
        }
        const statusBefore = lock.status;
        lock.status = FxLockStatus.EXPIRED;
        const saved = await manager.save(FxRateLock, lock);
        const occurredAt = new Date();
        const occurredIso = occurredAt.toISOString();
        const evt = new FxRateLockExpiredEvent(
          saved.id,
          saved.userId,
          null,
          null,
          null,
          saved.providerReference,
          statusBefore,
          saved.expiresAt.toISOString(),
          occurredIso,
        );
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.FX_RATE_LOCK_EXPIRED,
          correlationId: null,
          occurredAt,
          payload: evt.toJSON(),
        });
        n += 1;
      }
      if (n > 0) {
        this.logger.log(`FX lock expiry sweep: marked ${n} lock(s) EXPIRED`);
      }
      return n;
    });
  }
}
