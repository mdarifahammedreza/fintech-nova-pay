import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, In, Repository } from 'typeorm';
import { BaseRepository } from '../database/repositories/base.repository';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxStatus } from './outbox-status.enum';

export type NewOutboxEventRow = {
  routingKey: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  occurredAt: Date;
};

/**
 * Persistence only. Callers enqueue via {@link enqueueInTransaction} inside an
 * active `EntityManager` transaction started by the owning domain service.
 */
@Injectable()
export class OutboxRepository extends BaseRepository<OutboxEvent> {
  constructor(
    @InjectRepository(OutboxEvent)
    repository: Repository<OutboxEvent>,
  ) {
    super(repository);
  }

  enqueueInTransaction(
    manager: EntityManager,
    row: NewOutboxEventRow,
  ): Promise<OutboxEvent> {
    const entity = manager.getRepository(OutboxEvent).create({
      routingKey: row.routingKey,
      payload: row.payload,
      correlationId: row.correlationId ?? null,
      occurredAt: row.occurredAt,
      status: OutboxStatus.PENDING,
      publishedAt: null,
      claimedAt: null,
    } satisfies DeepPartial<OutboxEvent>);
    return manager.getRepository(OutboxEvent).save(entity);
  }

  /**
   * Claims up to `limit` `PENDING` rows for this worker: `SELECT … FOR UPDATE
   * SKIP LOCKED`, then sets `CLAIMED` in the same transaction. Safe for
   * multiple relay workers; publish happens after commit.
   */
  async claimPendingBatchForRelay(limit: number): Promise<OutboxEvent[]> {
    return this.repo.manager.transaction(async (manager) => {
      const pending = await manager
        .createQueryBuilder(OutboxEvent, 'e')
        .where('e.status = :st', { st: OutboxStatus.PENDING })
        .orderBy('e.createdAt', 'ASC')
        .take(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (pending.length === 0) {
        return [];
      }

      const now = new Date();
      await manager.update(
        OutboxEvent,
        { id: In(pending.map((r) => r.id)) },
        { status: OutboxStatus.CLAIMED, claimedAt: now },
      );

      return pending.map((row) =>
        Object.assign(row, { status: OutboxStatus.CLAIMED, claimedAt: now }),
      );
    });
  }

  /**
   * `CLAIMED` → `PUBLISHED`. Returns whether a row was updated (caller should
   * log if false after a successful-looking publish — possible stuck `CLAIMED`).
   */
  async markPublished(id: string): Promise<boolean> {
    const r = await this.repo.update(
      { id, status: OutboxStatus.CLAIMED },
      {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
        claimedAt: null,
      },
    );
    return (r.affected ?? 0) > 0;
  }

  /**
   * Same as {@link markPublished} but enforces **exactly one** row updated.
   * Use after broker confirm so drift is never silent.
   */
  async assertMarkPublishedExactlyOne(id: string): Promise<void> {
    const r = await this.repo.update(
      { id, status: OutboxStatus.CLAIMED },
      {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
        claimedAt: null,
      },
    );
    const n = r.affected ?? 0;
    if (n !== 1) {
      throw new Error(
        `Outbox markPublished: expected affected=1, got ${n} for id=${id}`,
      );
    }
  }

  /** `CLAIMED` → `FAILED`. Returns whether a row was updated. */
  async markFailed(id: string): Promise<boolean> {
    const r = await this.repo.update(
      { id, status: OutboxStatus.CLAIMED },
      { status: OutboxStatus.FAILED, claimedAt: null },
    );
    return (r.affected ?? 0) > 0;
  }

  /**
   * Resets stale `CLAIMED` rows to `PENDING` so another worker can retry.
   * `claimed_at` older than `maxAgeSeconds`, or `claimed_at` null with old
   * `created_at` (pre-migration rows). Consumers must dedupe by `messageId`.
   */
  async reclaimStaleClaimed(maxAgeSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
    const r = await this.repo
      .createQueryBuilder()
      .update(OutboxEvent)
      .set({ status: OutboxStatus.PENDING, claimedAt: null })
      .where('status = :st', { st: OutboxStatus.CLAIMED })
      .andWhere(
        '(claimed_at < :cutoff OR (claimed_at IS NULL AND created_at < :cutoff))',
        { cutoff },
      )
      .execute();
    return r.affected ?? 0;
  }
}
