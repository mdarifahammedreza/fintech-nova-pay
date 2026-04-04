import { Injectable } from '@nestjs/common';
import { PayrollBatch } from '../../entities/payroll-batch.entity';
import { PayrollItem } from '../../entities/payroll-item.entity';
import { PayrollService } from '../../service/payroll.service';
import { GetPayrollBatchByIdQuery } from '../impl/get-payroll-batch-by-id.query';

export type PayrollBatchWithItems = {
  batch: PayrollBatch;
  items: PayrollItem[];
};

@Injectable()
export class GetPayrollBatchByIdHandler {
  constructor(private readonly payroll: PayrollService) {}

  async execute(
    query: GetPayrollBatchByIdQuery,
  ): Promise<PayrollBatchWithItems | null> {
    const batch = await this.payroll.getBatchById(query.id);
    if (!batch) {
      return null;
    }
    const items = await this.payroll.listItemsByBatchId(query.id);
    return { batch, items };
  }
}
