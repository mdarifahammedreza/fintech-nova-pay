import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
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
    } satisfies DeepPartial<OutboxEvent>);
    return manager.getRepository(OutboxEvent).save(entity);
  }

  findOldestPending(limit: number): Promise<OutboxEvent[]> {
    return this.repo.find({
      where: { status: OutboxStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async markPublished(id: string): Promise<void> {
    await this.repo.update(
      { id },
      {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    );
  }

  async markFailed(id: string): Promise<void> {
    await this.repo.update({ id }, { status: OutboxStatus.FAILED });
  }
}
