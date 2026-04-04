export const PAYROLL_BATCH_FAILED_EVENT_NAME =
  'payroll.batch.failed' as const;

export type PayrollBatchFailedEventName =
  typeof PAYROLL_BATCH_FAILED_EVENT_NAME;

/**
 * Batch entered a terminal failure state. Outbox-driven post-commit.
 */
export class PayrollBatchFailedEvent {
  constructor(
    public readonly batchId: string,
    public readonly employerAccountId: string,
    public readonly reference: string,
    public readonly idempotencyKey: string,
    public readonly correlationId: string | null,
    /** Stable machine-readable code for consumers (e.g. FUNDING_REJECTED). */
    public readonly reasonCode: string,
    public readonly message: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): PayrollBatchFailedEventName {
    return PAYROLL_BATCH_FAILED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      batchId: this.batchId,
      employerAccountId: this.employerAccountId,
      reference: this.reference,
      idempotencyKey: this.idempotencyKey,
      correlationId: this.correlationId,
      reasonCode: this.reasonCode,
      message: this.message,
      occurredAt: this.occurredAt,
    };
  }
}
