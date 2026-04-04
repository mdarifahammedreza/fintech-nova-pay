import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { PayrollFundingReservation } from '../entities/payroll-funding-reservation.entity';

/** `payroll_funding_reservations` persistence; one row per batch. */
@Injectable()
export class PayrollFundingReservationRepository extends BaseRepository<PayrollFundingReservation> {
  constructor(
    @InjectRepository(PayrollFundingReservation)
    repository: Repository<PayrollFundingReservation>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<PayrollFundingReservation | null> {
    return this.findOneBy({ id });
  }

  findByBatchId(batchId: string): Promise<PayrollFundingReservation | null> {
    return this.findOne({
      where: { batch: { id: batchId } },
    });
  }

  findByLedgerTransactionId(
    ledgerTransactionId: string,
  ): Promise<PayrollFundingReservation | null> {
    return this.findOneBy({ ledgerTransactionId });
  }
}
