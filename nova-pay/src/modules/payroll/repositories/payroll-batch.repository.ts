import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';

/** `payroll_batches` persistence. */
@Injectable()
export class PayrollBatchRepository extends BaseRepository<PayrollBatch> {
  constructor(
    @InjectRepository(PayrollBatch)
    repository: Repository<PayrollBatch>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<PayrollBatch | null> {
    return this.findOneBy({ id });
  }

  findByEmployerAndIdempotencyKey(
    employerAccountId: string,
    idempotencyKey: string,
  ): Promise<PayrollBatch | null> {
    return this.findOneBy({ employerAccountId, idempotencyKey });
  }

  findByReference(reference: string): Promise<PayrollBatch | null> {
    return this.findOneBy({ reference });
  }

  findByCorrelationId(correlationId: string): Promise<PayrollBatch[]> {
    return this.findBy({ correlationId });
  }

  findByEmployerAccountId(employerAccountId: string): Promise<PayrollBatch[]> {
    return this.find({
      where: { employerAccountId },
      order: { createdAt: 'DESC' },
    });
  }

  findByEmployerAndStatus(
    employerAccountId: string,
    status: PayrollBatchStatus,
  ): Promise<PayrollBatch[]> {
    return this.find({
      where: { employerAccountId, status },
      order: { createdAt: 'DESC' },
    });
  }
}
