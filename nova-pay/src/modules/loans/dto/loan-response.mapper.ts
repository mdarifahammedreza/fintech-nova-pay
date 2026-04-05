import { Loan } from '../entities/loan.entity';
import { LoanResponseDto } from './loan-response.dto';

export function toLoanResponseDto(loan: Loan): LoanResponseDto {
  return {
    id: loan.id,
    borrowerUserId: loan.borrowerUserId,
    status: loan.status,
    principalAmount: loan.principalAmount,
    outstandingPrincipal: loan.outstandingPrincipal,
    currency: loan.currency,
    borrowerWalletAccountId: loan.borrowerWalletAccountId,
    loanFundingAccountId: loan.loanFundingAccountId,
    interestRateBps: loan.interestRateBps,
    termMonths: loan.termMonths,
    maturityDate: loan.maturityDate,
    disbursementPaymentId: loan.disbursementPaymentId,
    disbursementCorrelationId: loan.disbursementCorrelationId,
    lastRepaymentPaymentId: loan.lastRepaymentPaymentId,
    approvedAt: loan.approvedAt,
    disbursedAt: loan.disbursedAt,
    closedAt: loan.closedAt,
    rejectedAt: loan.rejectedAt,
    markedOverdueAt: loan.markedOverdueAt,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
  };
}
