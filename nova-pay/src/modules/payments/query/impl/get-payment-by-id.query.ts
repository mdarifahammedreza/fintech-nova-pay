/**
 * Read-side query: load payment by primary key.
 */
export class GetPaymentByIdQuery {
  constructor(public readonly id: string) {}
}
