/**
 * Employer payroll batch lifecycle (aggregate header).
 */
export enum PayrollBatchStatus {
  DRAFT = 'DRAFT',
  FUNDING_RESERVED = 'FUNDING_RESERVED',
  DISBURSING = 'DISBURSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
