import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';

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
}
