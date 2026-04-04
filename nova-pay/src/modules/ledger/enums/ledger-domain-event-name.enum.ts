/**
 * Canonical ledger outbox / routing names (NovaPay architecture).
 * Do not duplicate these string literals elsewhere — import this enum.
 */
export enum LedgerDomainEventName {
  TransactionPosted = 'ledger.transaction.posted',
  TransactionReversed = 'ledger.transaction.reversed',
}
