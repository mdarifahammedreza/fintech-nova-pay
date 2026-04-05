import { Injectable } from '@nestjs/common';
import { toLoanResponseDto } from '../../dto/loan-response.mapper';
import { LoanResponseDto } from '../../dto/loan-response.dto';
import { LoanOrchestrationService } from '../../service/loan-orchestration.service';
import { DisburseLoanCommand } from '../impl/disburse-loan.command';

@Injectable()
export class DisburseLoanHandler {
  constructor(private readonly loans: LoanOrchestrationService) {}

  async execute(command: DisburseLoanCommand): Promise<LoanResponseDto> {
    const loan = await this.loans.disburseApprovedToWallet(
      command.loanId,
      command.dto,
      command.actorUserId,
    );
    return toLoanResponseDto(loan);
  }
}
