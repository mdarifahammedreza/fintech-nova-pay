import { Currency } from '../../accounts/enums/currency.enum';
import { FxProvider } from '../enums/fx-provider.enum';

export const FX_RATE_LOCKED_EVENT_NAME = 'fx.rate.locked' as const;

export type FxRateLockedEventName = typeof FX_RATE_LOCKED_EVENT_NAME;

/**
 * Emitted when a rate lock row is committed. Enqueue via outbox in the same
 * transaction as the insert; never publish from controllers or pre-commit.
 */
export class FxRateLockedEvent {
  constructor(
    public readonly rateLockId: string,
    public readonly userId: string,
    public readonly reference: string | null,
    public readonly correlationId: string | null,
    public readonly idempotencyKey: string | null,
    public readonly providerReference: string | null,
    public readonly sourceCurrency: Currency,
    public readonly targetCurrency: Currency,
    public readonly sourceAmount: string,
    public readonly lockedRate: string,
    public readonly provider: FxProvider,
    public readonly expiresAt: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): FxRateLockedEventName {
    return FX_RATE_LOCKED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      rateLockId: this.rateLockId,
      userId: this.userId,
      reference: this.reference,
      correlationId: this.correlationId,
      idempotencyKey: this.idempotencyKey,
      providerReference: this.providerReference,
      sourceCurrency: this.sourceCurrency,
      targetCurrency: this.targetCurrency,
      sourceAmount: this.sourceAmount,
      lockedRate: this.lockedRate,
      provider: this.provider,
      expiresAt: this.expiresAt,
      occurredAt: this.occurredAt,
    };
  }
}
