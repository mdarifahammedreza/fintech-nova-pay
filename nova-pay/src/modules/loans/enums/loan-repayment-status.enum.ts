/** Lifecycle of a single repayment attempt row (links to `payments` when posted). */
export enum LoanRepaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
