/**
 * Value stored as `ledger_transactions.correlation_id` for the payment
 * orchestrator’s primary post (shared by writes and payment read DTOs).
 */
export function paymentLedgerCorrelationId(paymentId: string): string {
  return `payment:${paymentId}`;
}
