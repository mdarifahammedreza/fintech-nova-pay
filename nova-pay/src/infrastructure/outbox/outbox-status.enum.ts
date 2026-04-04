/**
 * Outbox relay lifecycle. Rows start `PENDING`, become `CLAIMED` inside a
 * short `SKIP LOCKED` transaction (one worker), then `PUBLISHED` after MQ
 * handoff, or `FAILED` for operator retry / inspection.
 */
export enum OutboxStatus {
  PENDING = 'PENDING',
  CLAIMED = 'CLAIMED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}
