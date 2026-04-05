import { Injectable } from '@nestjs/common';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import { LoanPersistenceService } from './loan-persistence.service';

/**
 * Application-facing read helpers for handlers/controllers.
 * Writes that touch money use {@link LoanOrchestrationService} instead.
 */
@Injectable()
export class LoansService {
  constructor(private readonly persistence: LoanPersistenceService) {}

  getLoanById(id: string): Promise<Loan | null> {
    return this.persistence.findLoanById(id);
  }

  listRepaymentsForLoan(loanId: string): Promise<LoanRepayment[]> {
    return this.persistence.listRepayments(loanId);
  }
}
