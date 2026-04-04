/**
 * Outbox relay lifecycle. Rows start `PENDING`, move to `PUBLISHED` after a
 * successful RabbitMQ handoff, or `FAILED` for operator retry / inspection.
 */
export enum OutboxStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}
