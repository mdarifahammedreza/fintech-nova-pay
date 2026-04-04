/**
 * Lifecycle of a ledger transaction row. Posted rows are terminal — do not
 * UPDATE in place; use a new transaction (e.g. type REVERSAL) to correct.
 */
export enum LedgerTransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
}
