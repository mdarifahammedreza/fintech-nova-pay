/**
 * Read-side query: resolve payment by business `reference`.
 */
export class GetPaymentByReferenceQuery {
  constructor(public readonly reference: string) {}
}
