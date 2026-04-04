/**
 * Posting side for double-entry lines. Amounts are stored as positive magnitudes;
 * type selects debit vs credit semantics for the account.
 */
export enum LedgerEntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}
