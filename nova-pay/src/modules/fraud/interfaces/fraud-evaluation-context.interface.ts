import { Currency } from '../../accounts/enums/currency.enum';

/**
 * Immutable input context for synchronous fraud evaluation (mirrors evaluate DTO).
 * Fraud does not load ledger rows here; callers pass denormalized facts.
 */
export interface FraudEvaluationContext {
  readonly userId: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly recipientAccountId: string;
  readonly senderAccountId: string;
  readonly amount: string;
  readonly currency: Currency;
  readonly paymentReference: string;
  readonly correlationId: string;
  readonly deviceId: string | null;
  readonly deviceFingerprint: string | null;
  readonly transactionTimestamp: Date;
}
