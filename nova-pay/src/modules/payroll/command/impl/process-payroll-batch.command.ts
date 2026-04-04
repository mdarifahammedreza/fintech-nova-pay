import { ProcessPayrollBatchDto } from '../../dto/process-payroll-batch.dto';

/**
 * Write-side command: reserve funds and execute disbursement for a batch.
 */
export class ProcessPayrollBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly dto: ProcessPayrollBatchDto,
  ) {}
}
