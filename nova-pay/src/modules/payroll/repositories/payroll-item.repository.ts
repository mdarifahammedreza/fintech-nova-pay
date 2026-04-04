import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';

/** `payroll_items` persistence. */
@Injectable()
export class PayrollItemRepository extends BaseRepository<PayrollItem> {
  constructor(
    @InjectRepository(PayrollItem)
    repository: Repository<PayrollItem>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<PayrollItem | null> {
    return this.findOneBy({ id });
  }

  findByBatchId(batchId: string): Promise<PayrollItem[]> {
    return this.find({
      where: { batch: { id: batchId } },
      order: { createdAt: 'ASC' },
    });
  }

  findByBatchIdAndItemReference(
    batchId: string,
    itemReference: string,
  ): Promise<PayrollItem | null> {
    return this.findOne({
      where: { batch: { id: batchId }, itemReference },
    });
  }

  findByBatchIdAndStatuses(
    batchId: string,
    statuses: PayrollItemStatus[],
  ): Promise<PayrollItem[]> {
    return this.find({
      where: { batch: { id: batchId }, status: In(statuses) },
      order: { createdAt: 'ASC' },
    });
  }

  findByEmployeeAccountId(employeeAccountId: string): Promise<PayrollItem[]> {
    return this.find({
      where: { employeeAccountId },
      order: { createdAt: 'DESC' },
    });
  }

  findByPaymentId(paymentId: string): Promise<PayrollItem | null> {
    return this.findOneBy({ paymentId });
  }
}
