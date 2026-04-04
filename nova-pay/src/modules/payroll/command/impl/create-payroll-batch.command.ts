import { CreatePayrollBatchDto } from '../../dto/create-payroll-batch.dto';

/**
 * Write-side command: create an employer payroll batch with line items.
 */
export class CreatePayrollBatchCommand {
  constructor(public readonly dto: CreatePayrollBatchDto) {}
}
