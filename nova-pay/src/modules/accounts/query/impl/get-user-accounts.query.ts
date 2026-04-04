/**
 * Read-side query: all accounts owned by a user (`userId` = `users.id`).
 */
export class GetUserAccountsQuery {
  constructor(public readonly userId: string) {}
}
