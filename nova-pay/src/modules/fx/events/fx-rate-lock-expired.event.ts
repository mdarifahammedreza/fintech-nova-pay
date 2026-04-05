import { FxLockStatus } from '../enums/fx-lock-status.enum';

export const FX_RATE_LOCK_EXPIRED_EVENT_NAME = 'fx.rate.lock.expired' as const;

export type FxRateLockExpiredEventName = typeof FX_RATE_LOCK_EXPIRED_EVENT_NAME;

/**
 * Emitted when a lock is no longer valid for consumption (TTL elapsed or
 * terminal status after expiry). Persist to the outbox in the same transaction
 * as the status transition or sweeper row update; relay publishes after commit.
 */
export class FxRateLockExpiredEvent {
  constructor(
    public readonly rateLockId: string,
    public readonly userId: string,
    public readonly reference: string | null,
    public readonly correlationId: string | null,
    public readonly idempotencyKey: string | null,
    public readonly providerReference: string | null,
    public readonly statusAtExpiry: FxLockStatus,
    public readonly expiresAt: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): FxRateLockExpiredEventName {
    return FX_RATE_LOCK_EXPIRED_EVENT_NAME;
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
      statusAtExpiry: this.statusAtExpiry,
      expiresAt: this.expiresAt,
      occurredAt: this.occurredAt,
    };
  }
}
