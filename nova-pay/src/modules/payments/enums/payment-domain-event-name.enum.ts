/**
 * Canonical payment outbox / routing names (NovaPay architecture).
 * Do not duplicate these string literals elsewhere — import this enum.
 */
export enum PaymentDomainEventName {
  Created = 'payment.created',
  Completed = 'payment.completed',
  Failed = 'payment.failed',
}
