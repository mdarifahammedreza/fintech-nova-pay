import { Injectable } from '@nestjs/common';
import { PayrollBatch } from '../../entities/payroll-batch.entity';
import { PayrollOrchestratorService } from '../../service/payroll-orchestrator.service';
import { ProcessPayrollBatchCommand } from '../impl/process-payroll-batch.command';

@Injectable()
export class ProcessPayrollBatchHandler {
  constructor(
    private readonly orchestrator: PayrollOrchestratorService,
  ) {}

  execute(command: ProcessPayrollBatchCommand): Promise<PayrollBatch> {
    return this.orchestrator.processPayrollBatch(
      command.batchId,
      command.dto,
    );
  }
}
