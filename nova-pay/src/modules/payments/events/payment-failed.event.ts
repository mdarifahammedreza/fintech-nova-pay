import { PaymentDomainEventName } from '../enums/payment-domain-event-name.enum';

/**
 * Emitted when a payment attempt ends in `FAILED` (e.g. validation, ledger,
 * or policy). Persist to outbox in the **same** transaction as the status
 * update; dispatch to MQ only **after** commit.
 */
export class PaymentFailedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly reference: string,
    public readonly correlationId: string | null,
    /** Stable idempotency slot for dedupe / support lookups. */
    public readonly idempotencyRecordId: string,
    /** ISO-8601 timestamp when failure was committed */
    public readonly occurredAt: string,
    /** Sanitized reason code or short message (no stack traces). */
    public readonly reason: string | null,
  ) {}

  get eventName(): PaymentDomainEventName {
    return PaymentDomainEventName.Failed;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      paymentId: this.paymentId,
      reference: this.reference,
      correlationId: this.correlationId,
      idempotencyRecordId: this.idempotencyRecordId,
      occurredAt: this.occurredAt,
      reason: this.reason,
    };
  }
}
