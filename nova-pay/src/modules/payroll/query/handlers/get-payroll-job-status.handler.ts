import { Injectable } from '@nestjs/common';
import { PayrollJobStatusView } from '../../interfaces/payroll-job-read.view';
import { PayrollService } from '../../service/payroll.service';
import { GetPayrollJobStatusQuery } from '../impl/get-payroll-job-status.query';

@Injectable()
export class GetPayrollJobStatusHandler {
  constructor(private readonly payroll: PayrollService) {}

  execute(
    query: GetPayrollJobStatusQuery,
  ): Promise<PayrollJobStatusView | null> {
    return this.payroll.getPayrollJobStatusView(query.jobId);
  }
}
