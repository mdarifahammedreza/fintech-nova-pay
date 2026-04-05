export const LOAN_OVERDUE_EVENT_NAME = 'loan.overdue' as const;

export type LoanOverdueEventName = typeof LOAN_OVERDUE_EVENT_NAME;

export class LoanOverdueEvent {
  constructor(
    public readonly loanId: string,
    public readonly maturityDate: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): LoanOverdueEventName {
    return LOAN_OVERDUE_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      loanId: this.loanId,
      maturityDate: this.maturityDate,
      occurredAt: this.occurredAt,
    };
  }
}
