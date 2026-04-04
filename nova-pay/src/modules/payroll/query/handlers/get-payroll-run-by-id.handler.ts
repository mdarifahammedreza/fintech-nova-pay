import { Injectable } from '@nestjs/common';
import { PayrollRun } from '../../entities/payroll-run.entity';
import { GetPayrollRunByIdQuery } from '../impl/get-payroll-run-by-id.query';

@Injectable()
export class GetPayrollRunByIdHandler {
  execute(_query: GetPayrollRunByIdQuery): Promise<PayrollRun | null> {
    return Promise.reject(
      new Error('Payroll: GetPayrollRunByIdHandler not implemented'),
    );
  }
}
