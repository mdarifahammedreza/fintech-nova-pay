import { Currency } from '../../accounts/enums/currency.enum';
import { PaymentDomainEventName } from '../enums/payment-domain-event-name.enum';
import { PaymentType } from '../enums/payment-type.enum';

/**
 * Emitted when a payment row is first persisted (e.g. `PENDING` / `PROCESSING`).
 * Written to the outbox in the **same** DB transaction as the insert, then
 * published **after** commit by the outbox processor — never from controllers
 * or pre-commit RabbitMQ publishers.
 */
export class PaymentCreatedEvent {
  constructor(
    public readonly paymentId: string,
    /** Business reference from the create request (reconciliation / support). */
    public readonly reference: string,
    /** Ties API → workers; distinct from idempotency key. */
    public readonly correlationId: string | null,
    /** Links replays to the idempotency slot row. */
    public readonly idempotencyRecordId: string,
    public readonly type: PaymentType,
    public readonly sourceAccountId: string,
    public readonly destinationAccountId: string,
    public readonly amount: string,
    public readonly currency: Currency,
    /** ISO-8601 timestamp when the payment row was committed */
    public readonly occurredAt: string,
  ) {}

  get eventName(): PaymentDomainEventName {
    return PaymentDomainEventName.Created;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      paymentId: this.paymentId,
      reference: this.reference,
      correlationId: this.correlationId,
      idempotencyRecordId: this.idempotencyRecordId,
      type: this.type,
      sourceAccountId: this.sourceAccountId,
      destinationAccountId: this.destinationAccountId,
      amount: this.amount,
      currency: this.currency,
      occurredAt: this.occurredAt,
    };
  }
}
