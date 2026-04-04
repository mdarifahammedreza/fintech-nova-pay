/**
 * High-level reason for a ledger bundle. Reversals are separate transactions,
 * not silent edits to existing rows.
 */
export enum LedgerTransactionType {
  TRANSFER = 'TRANSFER',
  PAYMENT = 'PAYMENT',
  REVERSAL = 'REVERSAL',
  ADJUSTMENT = 'ADJUSTMENT',
  FEE = 'FEE',
  FX_CONVERSION = 'FX_CONVERSION',
}
