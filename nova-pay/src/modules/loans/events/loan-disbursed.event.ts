export const LOAN_DISBURSED_EVENT_NAME = 'loan.disbursed' as const;

export type LoanDisbursedEventName = typeof LOAN_DISBURSED_EVENT_NAME;

export class LoanDisbursedEvent {
  constructor(
    public readonly loanId: string,
    public readonly paymentId: string,
    public readonly amount: string,
    public readonly currency: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): LoanDisbursedEventName {
    return LOAN_DISBURSED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      loanId: this.loanId,
      paymentId: this.paymentId,
      amount: this.amount,
      currency: this.currency,
      occurredAt: this.occurredAt,
    };
  }
}
