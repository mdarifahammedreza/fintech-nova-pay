/**
 * Loan aggregate lifecycle (header). Extend when product rules are defined.
 */
export enum LoanStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  OVERDUE = 'OVERDUE',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
}
