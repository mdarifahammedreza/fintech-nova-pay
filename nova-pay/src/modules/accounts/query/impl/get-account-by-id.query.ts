/**
 * Read-side query: load one account by primary key for an authenticated user.
 */
export class GetAccountByIdQuery {
  constructor(
    public readonly id: string,
    public readonly callerUserId: string,
  ) {}
}
