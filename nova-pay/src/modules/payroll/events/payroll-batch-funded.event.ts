import { Currency } from '../../accounts/enums/currency.enum';

export const PAYROLL_BATCH_FUNDED_EVENT_NAME =
  'payroll.batch.funded' as const;

export type PayrollBatchFundedEventName =
  typeof PAYROLL_BATCH_FUNDED_EVENT_NAME;

/** Funding ledger post committed; outbox row in same TX. */
export class PayrollBatchFundedEvent {
  constructor(
    public readonly batchId: string,
    public readonly employerAccountId: string,
    public readonly reference: string,
    public readonly correlationId: string | null,
    public readonly fundingReservationId: string,
    public readonly ledgerTransactionId: string,
    public readonly reservedAmount: string,
    public readonly currency: Currency,
    public readonly occurredAt: string,
  ) {}

  get eventName(): PayrollBatchFundedEventName {
    return PAYROLL_BATCH_FUNDED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      batchId: this.batchId,
      employerAccountId: this.employerAccountId,
      reference: this.reference,
      correlationId: this.correlationId,
      fundingReservationId: this.fundingReservationId,
      ledgerTransactionId: this.ledgerTransactionId,
      reservedAmount: this.reservedAmount,
      currency: this.currency,
      occurredAt: this.occurredAt,
    };
  }
}
