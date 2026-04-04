/**
 * Read-side query: load a payroll batch header and its line items.
 */
export class GetPayrollBatchByIdQuery {
  constructor(public readonly id: string) {}
}
