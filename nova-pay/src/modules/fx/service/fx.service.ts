import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { LockRateDto } from '../dto/lock-rate.dto';
import { FxRateLock } from '../entities/fx-rate-lock.entity';
import { FxLockStatus } from '../enums/fx-lock-status.enum';
import { FxProvider } from '../enums/fx-provider.enum';
import { FxRateLockedEvent } from '../events/fx-rate-locked.event';
import { FxRateLockRepository } from '../repositories/fx-rate-lock.repository';
import { FxProviderService } from './fx-provider.service';

/** Product default: rate locks expire 60s after creation (`expires_at`). */
const DEFAULT_LOCK_TTL_MS = 60_000;

export type FxLockStatusView = {
  lockId: string;
  status: FxLockStatus;
  lockedRate: string;
  expiresAt: Date;
  consumedAt: Date | null;
  timeRemainingSeconds: number;
  provider: FxProvider;
};

/**
 * Public FX application API: quote locks and lock inspection. Persistence
 * stays in {@link FxRateLockRepository}; no payment or ledger repositories.
 */
@Injectable()
export class FxService {
  constructor(
    private readonly rateLocks: FxRateLockRepository,
    private readonly fxProvider: FxProviderService,
    private readonly outbox: OutboxRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Acquire a fresh live rate and persist an ACTIVE lock until `expiresAt`
   * (`now` + `DEFAULT_LOCK_TTL_MS`, 60s).
   *
   * @param userId Authenticated subject (`jwt.sub`); must not come from client
   * headers or body.
   */
  async lockRate(userId: string, dto: LockRateDto): Promise<{
    lockId: string;
    lockedRate: string;
    expiresAt: Date;
    timeRemainingSeconds: number;
    provider: FxProvider;
  }> {
    const quote = await this.fxProvider.fetchLiveRate(
      dto.sourceCurrency,
      dto.targetCurrency,
    );
    const expiresAt = new Date(Date.now() + DEFAULT_LOCK_TTL_MS);
    return this.dataSource.transaction(async (manager) => {
      const row = manager.create(FxRateLock, {
        userId,
        sourceCurrency: dto.sourceCurrency,
        targetCurrency: dto.targetCurrency,
        sourceAmount: dto.sourceAmount,
        lockedRate: quote.rate,
        provider: quote.provider,
        providerReference: quote.providerReference,
        expiresAt,
        consumedAt: null,
        status: FxLockStatus.ACTIVE,
      });
      const saved = await manager.save(FxRateLock, row);
      const occurredAt = new Date();
      const evt = new FxRateLockedEvent(
        saved.id,
        userId,
        null,
        null,
        null,
        saved.providerReference,
        saved.sourceCurrency,
        saved.targetCurrency,
        saved.sourceAmount,
        saved.lockedRate,
        saved.provider,
        saved.expiresAt.toISOString(),
        occurredAt.toISOString(),
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.FX_RATE_LOCKED,
        correlationId: null,
        occurredAt,
        payload: evt.toJSON(),
      });
      const timeRemainingSeconds = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      );
      return {
        lockId: saved.id,
        lockedRate: saved.lockedRate,
        expiresAt: saved.expiresAt,
        timeRemainingSeconds,
        provider: saved.provider,
      };
    });
  }

  /**
   * Read-only eligibility check (no row lock). The orchestrator must still
   * call {@link assertLockConsumableWithLock} inside a transaction.
   */
  async validateLockForTransfer(
    userId: string,
    lockId: string,
    expectedSourceAmount: string,
  ): Promise<void> {
    const lock = await this.rateLocks.findByIdAndUserId(lockId, userId);
    if (!lock) {
      throw new NotFoundException('Rate lock not found');
    }
    if (lock.userId !== userId) {
      throw new ForbiddenException('Rate lock does not belong to caller');
    }
    if (lock.status !== FxLockStatus.ACTIVE) {
      throw new BadRequestException(
        `Rate lock is not active (status=${lock.status})`,
      );
    }
    if (lock.expiresAt <= new Date()) {
      throw new BadRequestException('Rate lock has expired');
    }
    if (lock.sourceAmount !== expectedSourceAmount) {
      throw new BadRequestException(
        'Amount does not match the locked source amount',
      );
    }
  }

  /**
   * Read-only status for an authenticated user (no FOR UPDATE).
   *
   * @param userId Authenticated subject (`jwt.sub`).
   */
  async getLockStatus(
    userId: string,
    lockId: string,
  ): Promise<FxLockStatusView> {
    const lock = await this.rateLocks.findByIdAndUserId(lockId, userId);
    if (!lock) {
      throw new NotFoundException('Rate lock not found');
    }
    const now = Date.now();
    const timeRemainingSeconds = Math.max(
      0,
      Math.floor((lock.expiresAt.getTime() - now) / 1000),
    );
    return {
      lockId: lock.id,
      status: lock.status,
      lockedRate: lock.lockedRate,
      expiresAt: lock.expiresAt,
      consumedAt: lock.consumedAt,
      timeRemainingSeconds,
      provider: lock.provider,
    };
  }

  /**
   * Validates ownership, ACTIVE, unexpired, and amount match under row lock.
   * Call only inside an open transaction.
   *
   * @param userId Authenticated subject (`jwt.sub`); must match `lock.userId`.
   */
  async assertLockConsumableWithLock(
    manager: EntityManager,
    userId: string,
    lockId: string,
    expectedSourceAmount: string,
  ): Promise<FxRateLock> {
    const lock = await manager
      .createQueryBuilder(FxRateLock, 'l')
      .setLock('pessimistic_write')
      .where('l.id = :id', { id: lockId })
      .getOne();
    if (!lock) {
      throw new NotFoundException('Rate lock not found');
    }
    if (lock.userId !== userId) {
      throw new ForbiddenException('Rate lock does not belong to caller');
    }
    if (lock.status !== FxLockStatus.ACTIVE) {
      throw new BadRequestException(
        `Rate lock is not active (status=${lock.status})`,
      );
    }
    const now = new Date();
    if (lock.expiresAt <= now) {
      throw new BadRequestException('Rate lock has expired');
    }
    if (lock.sourceAmount !== expectedSourceAmount) {
      throw new BadRequestException(
        'Amount does not match the locked source amount',
      );
    }
    return lock;
  }
}
