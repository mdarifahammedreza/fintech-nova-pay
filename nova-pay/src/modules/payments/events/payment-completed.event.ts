import { PaymentDomainEventName } from '../enums/payment-domain-event-name.enum';

/**
 * Emitted after ledger-first settlement and payment `COMPLETED` state.
 * Outbox insert must share the **same** PostgreSQL commit as ledger + payment
 * updates; RabbitMQ publish only **after** commit.
 */
export class PaymentCompletedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly reference: string,
    public readonly correlationId: string | null,
    /** Links completion to the idempotency slot (same as created/failed). */
    public readonly idempotencyRecordId: string,
    /** Posted ledger bundle that settled funds. */
    public readonly ledgerTransactionId: string,
    /** ISO-8601 timestamp when completion was committed */
    public readonly occurredAt: string,
  ) {}

  get eventName(): PaymentDomainEventName {
    return PaymentDomainEventName.Completed;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      paymentId: this.paymentId,
      reference: this.reference,
      correlationId: this.correlationId,
      idempotencyRecordId: this.idempotencyRecordId,
      ledgerTransactionId: this.ledgerTransactionId,
      occurredAt: this.occurredAt,
    };
  }
}
