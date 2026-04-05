/**
 * Read payroll job status. `jobId` is the same UUID as `payroll_batches.id`.
 */
export class GetPayrollJobStatusQuery {
  constructor(public readonly jobId: string) {}
}
