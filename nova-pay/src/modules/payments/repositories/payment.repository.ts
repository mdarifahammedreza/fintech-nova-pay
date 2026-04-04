import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { Payment } from '../entities/payment.entity';

/**
 * `payments` persistence. New or updated rows use {@link BaseRepository.save}
 * / {@link BaseRepository.saveMany} (status transitions are orchestrated
 * elsewhere).
 */
@Injectable()
export class PaymentRepository extends BaseRepository<Payment> {
  constructor(
    @InjectRepository(Payment)
    repository: Repository<Payment>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<Payment | null> {
    return this.findOneBy({ id });
  }

  findByReference(reference: string): Promise<Payment | null> {
    return this.findOneBy({ reference });
  }

  findByIdempotencyRecordId(
    idempotencyRecordId: string,
  ): Promise<Payment | null> {
    return this.findOneBy({ idempotencyRecordId });
  }
}
