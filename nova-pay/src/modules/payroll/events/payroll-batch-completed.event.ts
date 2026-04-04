import { Currency } from '../../accounts/enums/currency.enum';

export const PAYROLL_BATCH_COMPLETED_EVENT_NAME =
  'payroll.batch.completed' as const;

export type PayrollBatchCompletedEventName =
  typeof PAYROLL_BATCH_COMPLETED_EVENT_NAME;

/** Batch terminal success; outbox row in same TX. */
export class PayrollBatchCompletedEvent {
  constructor(
    public readonly batchId: string,
    public readonly employerAccountId: string,
    public readonly reference: string,
    public readonly idempotencyKey: string,
    public readonly correlationId: string | null,
    public readonly totalAmount: string,
    public readonly currency: Currency,
    public readonly completedItemCount: number,
    public readonly occurredAt: string,
  ) {}

  get eventName(): PayrollBatchCompletedEventName {
    return PAYROLL_BATCH_COMPLETED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      batchId: this.batchId,
      employerAccountId: this.employerAccountId,
      reference: this.reference,
      idempotencyKey: this.idempotencyKey,
      correlationId: this.correlationId,
      totalAmount: this.totalAmount,
      currency: this.currency,
      completedItemCount: this.completedItemCount,
      occurredAt: this.occurredAt,
    };
  }
}
