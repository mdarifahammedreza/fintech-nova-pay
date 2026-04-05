import { Injectable } from '@nestjs/common';
import { toLoanResponseDto } from '../../dto/loan-response.mapper';
import { LoanResponseDto } from '../../dto/loan-response.dto';
import { LoanOrchestrationService } from '../../service/loan-orchestration.service';
import { RepayLoanCommand } from '../impl/repay-loan.command';

@Injectable()
export class RepayLoanHandler {
  constructor(private readonly loans: LoanOrchestrationService) {}

  async execute(command: RepayLoanCommand): Promise<LoanResponseDto> {
    const loan = await this.loans.repayFromWallet(
      command.loanId,
      command.dto,
      command.actorUserId,
    );
    return toLoanResponseDto(loan);
  }
}
