/**
 * Read-side query: list accounts for `userId` only when it matches the caller
 * (`callerUserId` = JWT `sub`).
 */
export class GetUserAccountsQuery {
  constructor(
    public readonly userId: string,
    public readonly callerUserId: string,
  ) {}
}
