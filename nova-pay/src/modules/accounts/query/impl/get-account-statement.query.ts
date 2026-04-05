/**
 * Read-side: paginated ledger-backed statement for an owned account.
 */
export class GetAccountStatementQuery {
  constructor(
    public readonly accountId: string,
    public readonly callerUserId: string,
    public readonly page: number,
    public readonly limit: number,
  ) {}
}
