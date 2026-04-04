import { Currency } from '../../accounts/enums/currency.enum';

export const INTERNATIONAL_TRANSFER_CREATED_EVENT_NAME =
  'fx.international_transfer.created' as const;

export type InternationalTransferCreatedEventName =
  typeof INTERNATIONAL_TRANSFER_CREATED_EVENT_NAME;

/**
 * Product-level signal that an international (FX-backed) transfer was
 * initiated and persisted. Written to the outbox in the same transaction as
 * the trade + lock consume; do not call brokers from the HTTP request path.
 */
export class InternationalTransferCreatedEvent {
  constructor(
    public readonly transferId: string,
    public readonly rateLockId: string,
    public readonly userId: string,
    public readonly reference: string,
    public readonly correlationId: string | null,
    public readonly idempotencyKey: string,
    /** Optional scope key when the client namespaces idempotency. */
    public readonly idempotencyScopeKey: string | null,
    public readonly sourceAccountId: string,
    public readonly destinationAccountId: string,
    public readonly amount: string,
    public readonly sourceCurrency: Currency,
    public readonly targetCurrency: Currency,
    public readonly occurredAt: string,
  ) {}

  get eventName(): InternationalTransferCreatedEventName {
    return INTERNATIONAL_TRANSFER_CREATED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      transferId: this.transferId,
      rateLockId: this.rateLockId,
      userId: this.userId,
      reference: this.reference,
      correlationId: this.correlationId,
      idempotencyKey: this.idempotencyKey,
      idempotencyScopeKey: this.idempotencyScopeKey,
      sourceAccountId: this.sourceAccountId,
      destinationAccountId: this.destinationAccountId,
      amount: this.amount,
      sourceCurrency: this.sourceCurrency,
      targetCurrency: this.targetCurrency,
      occurredAt: this.occurredAt,
    };
  }
}
