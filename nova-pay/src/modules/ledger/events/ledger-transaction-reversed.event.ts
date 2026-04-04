/**
 * Stable identifier for outbox rows and message routing. Do not concatenate
 * ad hoc strings at publishers — use this enum member.
 */
export enum LedgerTransactionReversedEventName {
  TransactionReversed = 'ledger.transaction.reversed',
}

/**
 * Payload written to the outbox in the **same** DB transaction as the
 * compensating ledger post, then published **after** commit by the outbox
 * processor only — never publish this synchronously from `ReversalService`.
 */
export class LedgerTransactionReversedEvent {
  constructor(
    /** New reversal `LedgerTransaction.id` */
    public readonly ledgerTransactionId: string,
    /** Prior posted transaction that was offset */
    public readonly originalLedgerTransactionId: string,
    public readonly correlationId: string | null,
    /** ISO-8601 timestamp when the reversal row was committed */
    public readonly occurredAt: string,
  ) {}

  get eventName(): LedgerTransactionReversedEventName {
    return LedgerTransactionReversedEventName.TransactionReversed;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      ledgerTransactionId: this.ledgerTransactionId,
      originalLedgerTransactionId: this.originalLedgerTransactionId,
      correlationId: this.correlationId,
      occurredAt: this.occurredAt,
    };
  }
}
