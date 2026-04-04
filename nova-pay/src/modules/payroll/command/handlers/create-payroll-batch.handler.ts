import { Injectable } from '@nestjs/common';
import {
  CreatePayrollBatchResult,
  PayrollOrchestratorService,
} from '../../service/payroll-orchestrator.service';
import { CreatePayrollBatchCommand } from '../impl/create-payroll-batch.command';

@Injectable()
export class CreatePayrollBatchHandler {
  constructor(
    private readonly orchestrator: PayrollOrchestratorService,
  ) {}

  execute(
    command: CreatePayrollBatchCommand,
  ): Promise<CreatePayrollBatchResult> {
    return this.orchestrator.createPayrollBatch(command.dto);
  }
}
