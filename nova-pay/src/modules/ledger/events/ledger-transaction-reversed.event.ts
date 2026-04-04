import { LedgerDomainEventName } from '../enums/ledger-domain-event-name.enum';

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
    /** Correlation on the reversal posting (if any). */
    public readonly correlationId: string | null,
    /**
     * Correlation from the original posted transaction (support / chain
     * tracing without loading the prior row).
     */
    public readonly originalCorrelationId: string | null,
    /** ISO-8601 timestamp when the reversal row was committed */
    public readonly occurredAt: string,
  ) {}

  get eventName(): LedgerDomainEventName {
    return LedgerDomainEventName.TransactionReversed;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      ledgerTransactionId: this.ledgerTransactionId,
      originalLedgerTransactionId: this.originalLedgerTransactionId,
      correlationId: this.correlationId,
      originalCorrelationId: this.originalCorrelationId,
      occurredAt: this.occurredAt,
    };
  }
}
