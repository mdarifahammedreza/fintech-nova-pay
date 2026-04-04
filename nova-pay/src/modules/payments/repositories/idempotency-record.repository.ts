import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import {
  IdempotencyRecord,
  IdempotencyRecordStatus,
} from '../entities/idempotency-record.entity';

/**
 * `payments_idempotency_records` persistence. New rows use
 * {@link BaseRepository.save} / {@link BaseRepository.saveMany}.
 */
@Injectable()
export class IdempotencyRecordRepository extends BaseRepository<IdempotencyRecord> {
  constructor(
    @InjectRepository(IdempotencyRecord)
    repository: Repository<IdempotencyRecord>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<IdempotencyRecord | null> {
    return this.findOneBy({ id });
  }

  /**
   * Composite unique key (`idempotency_key` + `scope_key`; `scopeKey` '' when
   * unused).
   */
  findByIdempotencyKey(
    idempotencyKey: string,
    scopeKey = '',
  ): Promise<IdempotencyRecord | null> {
    return this.findOneBy({ idempotencyKey, scopeKey });
  }

  /**
   * `SELECT … FOR UPDATE` on the idempotency slot inside caller’s transaction.
   */
  findByIdempotencyKeyForUpdate(
    manager: EntityManager,
    idempotencyKey: string,
    scopeKey: string,
  ): Promise<IdempotencyRecord | null> {
    return manager.findOne(IdempotencyRecord, {
      where: { idempotencyKey, scopeKey },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /**
   * Read-after-insert conflict reload (same `EntityManager` as the posting TX).
   */
  findByIdempotencyKeyInTransaction(
    manager: EntityManager,
    idempotencyKey: string,
    scopeKey: string,
  ): Promise<IdempotencyRecord | null> {
    return manager.findOne(IdempotencyRecord, {
      where: { idempotencyKey, scopeKey },
    });
  }

  /**
   * Insert pending slot; on unique-key race, caller catches `23505` and reloads.
   */
  insertPendingInTransaction(
    manager: EntityManager,
    input: {
      idempotencyKey: string;
      scopeKey: string;
      requestFingerprint: string;
    },
  ): Promise<IdempotencyRecord> {
    const repo = manager.getRepository(IdempotencyRecord);
    const row = repo.create({
      idempotencyKey: input.idempotencyKey,
      scopeKey: input.scopeKey,
      status: IdempotencyRecordStatus.PENDING,
      requestFingerprint: input.requestFingerprint,
      linkedPaymentId: null,
      businessReference: null,
    });
    return repo.save(row);
  }
}
