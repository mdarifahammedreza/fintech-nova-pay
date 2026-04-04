import { SubmitPayrollRunDto } from '../../dto/submit-payroll-run.dto';

/**
 * Write-side command: submit a payroll run for processing.
 */
export class SubmitPayrollRunCommand {
  constructor(public readonly dto: SubmitPayrollRunDto) {}
}
