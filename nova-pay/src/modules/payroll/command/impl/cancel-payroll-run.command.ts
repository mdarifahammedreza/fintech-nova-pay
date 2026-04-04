import { CancelPayrollRunDto } from '../../dto/cancel-payroll-run.dto';

/**
 * Write-side command: cancel a payroll run.
 */
export class CancelPayrollRunCommand {
  constructor(
    public readonly payrollRunId: string,
    public readonly dto: CancelPayrollRunDto,
  ) {}
}
