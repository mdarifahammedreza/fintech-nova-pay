import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

/**
 * Stable identifier for outbox rows and message routing. Do not concatenate
 * ad hoc strings at publishers — use this enum member.
 */
export enum LedgerTransactionPostedEventName {
  TransactionPosted = 'ledger.transaction.posted',
}

/**
 * Payload written to the outbox in the **same** DB transaction as the ledger
 * post, then published to RabbitMQ **after** commit by the outbox processor
 * only — never publish this synchronously from `PostingService`.
 */
export class LedgerTransactionPostedEvent {
  constructor(
    public readonly ledgerTransactionId: string,
    public readonly correlationId: string | null,
    public readonly type: LedgerTransactionType,
    public readonly reversesTransactionId: string | null,
    public readonly entryCount: number,
    /** ISO-8601 timestamp when the transaction row was committed */
    public readonly occurredAt: string,
  ) {}

  get eventName(): LedgerTransactionPostedEventName {
    return LedgerTransactionPostedEventName.TransactionPosted;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      ledgerTransactionId: this.ledgerTransactionId,
      correlationId: this.correlationId,
      type: this.type,
      reversesTransactionId: this.reversesTransactionId,
      entryCount: this.entryCount,
      occurredAt: this.occurredAt,
    };
  }
}
