import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import {
  PayrollJobCompletionReportView,
  PayrollJobFailureLineView,
  PayrollJobStatusView,
} from '../interfaces/payroll-job-read.view';

export class PayrollJobFailureLineDto {
  @ApiProperty({ format: 'uuid' })
  itemId: string;

  @ApiProperty()
  itemReference: string;

  @ApiProperty({ format: 'uuid' })
  employeeAccountId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Error detail when the line failed',
  })
  failureReason: string | null;
}

/**
 * Canonical payroll job status (same UUID as payroll_batches.id).
 * Prefer GET /payroll/jobs/:jobId; GET /payroll/batches/:batchId/status is an
 * equivalent alias.
 */
export class PayrollJobStatusResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Job id — identical to payroll_batches.id',
  })
  jobId: string;

  @ApiProperty({ format: 'uuid' })
  employerAccountId: string;

  @ApiProperty({ enum: PayrollBatchStatus })
  batchStatus: PayrollBatchStatus;

  @ApiProperty()
  reference: string;

  @ApiProperty({ nullable: true })
  correlationId: string | null;

  @ApiProperty({ description: 'Scheduled gross total for the batch' })
  totalAmount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ description: 'Number of payroll lines' })
  linesTotal: number;

  @ApiProperty()
  linesPending: number;

  @ApiProperty()
  linesCompleted: number;

  @ApiProperty()
  linesFailed: number;

  @ApiProperty({
    description:
      'Share of lines that reached a terminal line state (completed or failed)',
    minimum: 0,
    maximum: 100,
  })
  disbursementProgressPercent: number;

  @ApiProperty({
    description: 'True when employer to clearing funding ledger post exists',
  })
  fundingPosted: boolean;

  @ApiProperty({ format: 'uuid', nullable: true })
  fundingReservationId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  fundingLedgerTransactionId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PayrollJobCompletionReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  jobId: string;

  @ApiProperty({ enum: PayrollBatchStatus })
  batchStatus: PayrollBatchStatus;

  @ApiProperty()
  reference: string;

  @ApiProperty({ nullable: true })
  correlationId: string | null;

  @ApiProperty()
  totalAmountScheduled: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  lineCount: number;

  @ApiProperty()
  successCount: number;

  @ApiProperty()
  failureCount: number;

  @ApiProperty({ description: 'Sum of amounts for COMPLETED lines' })
  amountSucceeded: string;

  @ApiProperty({ description: 'Sum of amounts for FAILED lines' })
  amountFailed: string;

  @ApiProperty({ type: PayrollJobFailureLineDto, isArray: true })
  failures: PayrollJobFailureLineDto[];

  @ApiProperty({
    description: 'Batch header updatedAt when report was generated (ISO 8601)',
  })
  completedAt: string;
}

export function toPayrollJobStatusResponseDto(
  v: PayrollJobStatusView,
): PayrollJobStatusResponseDto {
  return { ...v };
}

function mapFailureLine(f: PayrollJobFailureLineView): PayrollJobFailureLineDto {
  return {
    itemId: f.itemId,
    itemReference: f.itemReference,
    employeeAccountId: f.employeeAccountId,
    amount: f.amount,
    currency: f.currency,
    failureReason: f.failureReason,
  };
}

export function toPayrollJobCompletionReportResponseDto(
  r: PayrollJobCompletionReportView,
): PayrollJobCompletionReportResponseDto {
  return {
    jobId: r.jobId,
    batchStatus: r.batchStatus,
    reference: r.reference,
    correlationId: r.correlationId,
    totalAmountScheduled: r.totalAmountScheduled,
    currency: r.currency,
    lineCount: r.lineCount,
    successCount: r.successCount,
    failureCount: r.failureCount,
    amountSucceeded: r.amountSucceeded,
    amountFailed: r.amountFailed,
    failures: r.failures.map(mapFailureLine),
    completedAt: r.completedAt,
  };
}
