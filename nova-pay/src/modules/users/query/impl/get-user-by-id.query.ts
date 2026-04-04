/**
 * Read-side query: resolve a user by primary key.
 */
export class GetUserByIdQuery {
  constructor(public readonly id: string) {}
}
