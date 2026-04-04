import { LedgerDomainEventName } from '../enums/ledger-domain-event-name.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

/**
 * Payload written to the outbox in the **same** DB transaction as the ledger
 * post, then published to RabbitMQ **after** commit by the outbox processor
 * only — never publish this synchronously from `PostingService`.
 */
export class LedgerTransactionPostedEvent {
  constructor(
    public readonly ledgerTransactionId: string,
    /** Caller idempotency / trace key (e.g. `payment:<uuid>`). */
    public readonly correlationId: string | null,
    public readonly type: LedgerTransactionType,
    public readonly reversesTransactionId: string | null,
    public readonly entryCount: number,
    /** Optional human-readable trace line (mirrors `ledger_transactions.memo`). */
    public readonly memo: string | null,
    /** ISO-8601 timestamp when the transaction row was committed */
    public readonly occurredAt: string,
  ) {}

  get eventName(): LedgerDomainEventName {
    return LedgerDomainEventName.TransactionPosted;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      ledgerTransactionId: this.ledgerTransactionId,
      correlationId: this.correlationId,
      type: this.type,
      reversesTransactionId: this.reversesTransactionId,
      entryCount: this.entryCount,
      memo: this.memo,
      occurredAt: this.occurredAt,
    };
  }
}
