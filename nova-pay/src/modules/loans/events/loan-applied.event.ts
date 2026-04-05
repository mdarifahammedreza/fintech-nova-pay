export const LOAN_APPLIED_EVENT_NAME = 'loan.applied' as const;

export type LoanAppliedEventName = typeof LOAN_APPLIED_EVENT_NAME;

/** Outbox payload shape after successful apply — refine when implemented. */
export class LoanAppliedEvent {
  constructor(
    public readonly loanId: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): LoanAppliedEventName {
    return LOAN_APPLIED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      loanId: this.loanId,
      occurredAt: this.occurredAt,
    };
  }
}
