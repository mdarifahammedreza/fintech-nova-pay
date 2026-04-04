/**
 * RabbitMQ routing keys / domain event names. Persisted on {@link OutboxEvent}
 * rows; relay publishes these verbatim after commit.
 */
export enum OutboxRoutingKey {
  LEDGER_TRANSACTION_POSTED = 'ledger.transaction.posted',
  LEDGER_TRANSACTION_REVERSED = 'ledger.transaction.reversed',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
}
