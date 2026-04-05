/**
 * Read payroll completion report for a terminal batch (COMPLETED or FAILED).
 */
export class GetPayrollJobCompletionReportQuery {
  constructor(public readonly jobId: string) {}
}
