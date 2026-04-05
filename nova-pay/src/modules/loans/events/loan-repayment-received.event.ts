export const LOAN_REPAYMENT_RECEIVED_EVENT_NAME =
  'loan.repayment.received' as const;

export type LoanRepaymentReceivedEventName =
  typeof LOAN_REPAYMENT_RECEIVED_EVENT_NAME;

export class LoanRepaymentReceivedEvent {
  constructor(
    public readonly loanId: string,
    public readonly paymentId: string,
    public readonly amount: string,
    public readonly currency: string,
    public readonly outstandingPrincipalAfter: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): LoanRepaymentReceivedEventName {
    return LOAN_REPAYMENT_RECEIVED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      loanId: this.loanId,
      paymentId: this.paymentId,
      amount: this.amount,
      currency: this.currency,
      outstandingPrincipalAfter: this.outstandingPrincipalAfter,
      occurredAt: this.occurredAt,
    };
  }
}
