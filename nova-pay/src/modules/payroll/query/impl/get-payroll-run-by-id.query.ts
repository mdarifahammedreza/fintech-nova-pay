/**
 * Read-side query: load a payroll run by primary key.
 */
export class GetPayrollRunByIdQuery {
  constructor(public readonly id: string) {}
}
