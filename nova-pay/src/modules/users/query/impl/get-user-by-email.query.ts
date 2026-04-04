/**
 * Read-side query: resolve a user by unique email.
 */
export class GetUserByEmailQuery {
  constructor(public readonly email: string) {}
}
