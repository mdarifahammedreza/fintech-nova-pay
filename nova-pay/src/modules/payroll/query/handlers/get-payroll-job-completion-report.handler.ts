import { Injectable } from '@nestjs/common';
import { PayrollJobCompletionReportResult } from '../../interfaces/payroll-job-read.view';
import { PayrollService } from '../../service/payroll.service';
import { GetPayrollJobCompletionReportQuery } from '../impl/get-payroll-job-completion-report.query';

@Injectable()
export class GetPayrollJobCompletionReportHandler {
  constructor(private readonly payroll: PayrollService) {}

  execute(
    query: GetPayrollJobCompletionReportQuery,
  ): Promise<PayrollJobCompletionReportResult> {
    return this.payroll.getPayrollJobCompletionReport(query.jobId);
  }
}
