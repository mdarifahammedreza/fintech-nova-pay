import { Currency } from '../../accounts/enums/currency.enum';

export const PAYROLL_BATCH_CREATED_EVENT_NAME =
  'payroll.batch.created' as const;

export type PayrollBatchCreatedEventName =
  typeof PAYROLL_BATCH_CREATED_EVENT_NAME;

/** Persisted batch + lines; enqueue to outbox in same TX as DB write. */
export class PayrollBatchCreatedEvent {
  constructor(
    public readonly batchId: string,
    public readonly employerAccountId: string,
    public readonly reference: string,
    public readonly idempotencyKey: string,
    public readonly correlationId: string | null,
    public readonly externalBatchRef: string | null,
    public readonly totalAmount: string,
    public readonly currency: Currency,
    public readonly itemCount: number,
    public readonly occurredAt: string,
  ) {}

  get eventName(): PayrollBatchCreatedEventName {
    return PAYROLL_BATCH_CREATED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      batchId: this.batchId,
      employerAccountId: this.employerAccountId,
      reference: this.reference,
      idempotencyKey: this.idempotencyKey,
      correlationId: this.correlationId,
      externalBatchRef: this.externalBatchRef,
      totalAmount: this.totalAmount,
      currency: this.currency,
      itemCount: this.itemCount,
      occurredAt: this.occurredAt,
    };
  }
}
