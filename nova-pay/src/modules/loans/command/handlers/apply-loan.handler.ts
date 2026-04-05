import { Injectable } from '@nestjs/common';
import { toLoanResponseDto } from '../../dto/loan-response.mapper';
import { LoanResponseDto } from '../../dto/loan-response.dto';
import { LoanOrchestrationService } from '../../service/loan-orchestration.service';
import { ApplyLoanCommand } from '../impl/apply-loan.command';

@Injectable()
export class ApplyLoanHandler {
  constructor(private readonly loans: LoanOrchestrationService) {}

  async execute(command: ApplyLoanCommand): Promise<LoanResponseDto> {
    const loan = await this.loans.applyForLoan(
      command.dto,
      command.actorUserId,
    );
    return toLoanResponseDto(loan);
  }
}
