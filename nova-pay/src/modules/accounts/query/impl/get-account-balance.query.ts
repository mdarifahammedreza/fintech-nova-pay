/**
 * Read-side query: account balance projection for an authenticated owner.
 */
export class GetAccountBalanceQuery {
  constructor(
    public readonly accountId: string,
    public readonly callerUserId: string,
  ) {}
}
