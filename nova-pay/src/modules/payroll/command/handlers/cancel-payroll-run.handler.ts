import { Injectable } from '@nestjs/common';
import { PayrollRun } from '../../entities/payroll-run.entity';
import { CancelPayrollRunCommand } from '../impl/cancel-payroll-run.command';

@Injectable()
export class CancelPayrollRunHandler {
  execute(_command: CancelPayrollRunCommand): Promise<PayrollRun> {
    return Promise.reject(
      new Error('Payroll: CancelPayrollRunHandler not implemented'),
    );
  }
}
