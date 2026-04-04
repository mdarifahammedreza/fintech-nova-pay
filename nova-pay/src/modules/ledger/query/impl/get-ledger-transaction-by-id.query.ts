/**
 * Read-side query: load a ledger transaction with entry lines.
 */
export class GetLedgerTransactionByIdQuery {
  constructor(public readonly id: string) {}
}
