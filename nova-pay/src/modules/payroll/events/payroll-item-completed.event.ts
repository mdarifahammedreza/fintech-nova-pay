import { Currency } from '../../accounts/enums/currency.enum';

export const PAYROLL_ITEM_COMPLETED_EVENT_NAME =
  'payroll.item.completed' as const;

export type PayrollItemCompletedEventName =
  typeof PAYROLL_ITEM_COMPLETED_EVENT_NAME;

/** Line payout committed; outbox row in same TX. */
export class PayrollItemCompletedEvent {
  constructor(
    public readonly batchId: string,
    public readonly itemId: string,
    public readonly itemReference: string,
    public readonly employeeAccountId: string,
    public readonly batchReference: string,
    public readonly batchCorrelationId: string | null,
    public readonly paymentId: string | null,
    public readonly ledgerTransactionId: string | null,
    public readonly amount: string,
    public readonly currency: Currency,
    public readonly occurredAt: string,
  ) {}

  get eventName(): PayrollItemCompletedEventName {
    return PAYROLL_ITEM_COMPLETED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      batchId: this.batchId,
      itemId: this.itemId,
      itemReference: this.itemReference,
      employeeAccountId: this.employeeAccountId,
      batchReference: this.batchReference,
      batchCorrelationId: this.batchCorrelationId,
      paymentId: this.paymentId,
      ledgerTransactionId: this.ledgerTransactionId,
      amount: this.amount,
      currency: this.currency,
      occurredAt: this.occurredAt,
    };
  }
}
