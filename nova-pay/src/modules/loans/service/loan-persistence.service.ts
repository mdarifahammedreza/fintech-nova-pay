import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Loan } from '../entities/loan.entity';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import { LoanRepaymentRepository } from '../repositories/loan-repayment.repository';
import { LoanRepository } from '../repositories/loan.repository';

/**
 * Loan module persistence only — repositories and `EntityManager` saves.
 * No ledger/payment calls, no outbox, no domain state machine.
 */
@Injectable()
export class LoanPersistenceService {
  constructor(
    private readonly loans: LoanRepository,
    private readonly repayments: LoanRepaymentRepository,
  ) {}

  findLoanById(id: string): Promise<Loan | null> {
    return this.loans.findById(id);
  }

  findLoanByApplyIdempotency(
    key: string,
    scopeKey: string,
  ): Promise<Loan | null> {
    return this.loans.findByApplyIdempotencyKey(key, scopeKey);
  }

  findLoansForBorrower(userId: string): Promise<Loan[]> {
    return this.loans.findByBorrowerUserId(userId);
  }

  findActiveLoansPastMaturity(cutoff: Date): Promise<Loan[]> {
    return this.loans.findActiveWithMaturityBefore(cutoff);
  }

  listRepayments(loanId: string): Promise<LoanRepayment[]> {
    return this.repayments.findByLoanId(loanId);
  }

  saveLoan(loan: Loan): Promise<Loan> {
    return this.loans.save(loan);
  }

  saveRepayment(row: LoanRepayment): Promise<LoanRepayment> {
    return this.repayments.save(row);
  }

  lockLoanById(
    manager: EntityManager,
    loanId: string,
  ): Promise<Loan | null> {
    return this.loans.findByIdForUpdate(manager, loanId);
  }

  persistLoanInTransaction(
    manager: EntityManager,
    loan: Loan,
  ): Promise<Loan> {
    return this.loans.saveWithManager(manager, loan);
  }

  persistRepaymentInTransaction(
    manager: EntityManager,
    row: LoanRepayment,
  ): Promise<LoanRepayment> {
    return this.repayments.saveWithManager(manager, row);
  }
}
