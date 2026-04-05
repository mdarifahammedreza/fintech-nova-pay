import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toLoanResponseDto } from '../../dto/loan-response.mapper';
import { LoanResponseDto } from '../../dto/loan-response.dto';
import { LoansService } from '../../service/loans.service';
import { GetLoanByIdQuery } from '../impl/get-loan-by-id.query';

@Injectable()
export class GetLoanByIdHandler {
  constructor(private readonly loans: LoansService) {}

  async execute(query: GetLoanByIdQuery): Promise<LoanResponseDto> {
    const loan = await this.loans.getLoanById(query.loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    if (loan.borrowerUserId !== query.actorUserId) {
      throw new ForbiddenException('Loan not accessible');
    }
    return toLoanResponseDto(loan);
  }
}
