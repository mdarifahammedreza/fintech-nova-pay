/**
 * RabbitMQ routing keys / domain event names. Persisted on {@link OutboxEvent}
 * rows; relay publishes these verbatim after commit.
 */
export enum OutboxRoutingKey {
  LEDGER_TRANSACTION_POSTED = 'ledger.transaction.posted',
  LEDGER_TRANSACTION_REVERSED = 'ledger.transaction.reversed',
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  FRAUD_RISK_BLOCKED = 'fraud.risk.blocked',
  FRAUD_RISK_ACTION_REQUIRED = 'fraud.risk.action_required',
  FRAUD_RISK_REVIEW_TRIGGERED = 'fraud.risk.review_triggered',
  ACCOUNT_CREATED = 'account.created',
  ACCOUNT_FROZEN = 'account.frozen',
  ACCOUNT_UNFROZEN = 'account.unfrozen',
  PAYROLL_BATCH_CREATED = 'payroll.batch.created',
  FX_RATE_LOCKED = 'fx.rate.locked',
  FX_TRADE_EXECUTED = 'fx.trade.executed',
  FX_INTERNATIONAL_TRANSFER_CREATED = 'fx.international_transfer.created',
}
