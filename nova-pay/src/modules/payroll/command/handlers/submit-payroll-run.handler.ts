import { Injectable } from '@nestjs/common';
import { PayrollRun } from '../../entities/payroll-run.entity';
import { SubmitPayrollRunCommand } from '../impl/submit-payroll-run.command';

@Injectable()
export class SubmitPayrollRunHandler {
  execute(_command: SubmitPayrollRunCommand): Promise<PayrollRun> {
    return Promise.reject(
      new Error('Payroll: SubmitPayrollRunHandler not implemented'),
    );
  }
}
