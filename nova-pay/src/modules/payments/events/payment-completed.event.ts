/**
 * Stable identifier for outbox rows and message routing. Do not concatenate
 * ad hoc strings at publishers — use this enum member.
 */
export enum PaymentCompletedEventName {
  PaymentCompleted = 'payment.completed',
}

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
    /** Posted ledger bundle that settled funds. */
    public readonly ledgerTransactionId: string,
    /** ISO-8601 timestamp when completion was committed */
    public readonly occurredAt: string,
  ) {}

  get eventName(): PaymentCompletedEventName {
    return PaymentCompletedEventName.PaymentCompleted;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      paymentId: this.paymentId,
      reference: this.reference,
      correlationId: this.correlationId,
      ledgerTransactionId: this.ledgerTransactionId,
      occurredAt: this.occurredAt,
    };
  }
}
