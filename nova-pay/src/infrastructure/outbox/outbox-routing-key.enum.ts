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
  FRAUD_FLAG_RESOLVED = 'fraud.flag.resolved',
  ACCOUNT_CREATED = 'account.created',
  ACCOUNT_FROZEN = 'account.frozen',
  ACCOUNT_UNFROZEN = 'account.unfrozen',
  PAYROLL_BATCH_CREATED = 'payroll.batch.created',
  PAYROLL_BATCH_FUNDED = 'payroll.batch.funded',
  PAYROLL_BATCH_COMPLETED = 'payroll.batch.completed',
  PAYROLL_BATCH_FAILED = 'payroll.batch.failed',
  PAYROLL_ITEM_COMPLETED = 'payroll.item.completed',
  FX_RATE_LOCKED = 'fx.rate.locked',
  FX_RATE_LOCK_EXPIRED = 'fx.rate.lock.expired',
  FX_TRADE_EXECUTED = 'fx.trade.executed',
  FX_INTERNATIONAL_TRANSFER_CREATED = 'fx.international_transfer.created',
  LOAN_APPLIED = 'loan.applied',
  LOAN_DISBURSED = 'loan.disbursed',
  LOAN_REPAYMENT_RECEIVED = 'loan.repayment.received',
  LOAN_OVERDUE = 'loan.overdue',
}
