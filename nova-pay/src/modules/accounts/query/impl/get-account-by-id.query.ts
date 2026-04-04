/**
 * Read-side query: load one account by primary key.
 */
export class GetAccountByIdQuery {
  constructor(public readonly id: string) {}
}
