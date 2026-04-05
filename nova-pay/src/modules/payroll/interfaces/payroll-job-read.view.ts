import { Currency } from '../../accounts/enums/currency.enum';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';

/** Read model for GET payroll job / batch status. */
export type PayrollJobStatusView = {
  jobId: string;
  employerAccountId: string;
  batchStatus: PayrollBatchStatus;
  reference: string;
  correlationId: string | null;
  totalAmount: string;
  currency: Currency;
  linesTotal: number;
  linesPending: number;
  linesCompleted: number;
  linesFailed: number;
  disbursementProgressPercent: number;
  fundingPosted: boolean;
  fundingReservationId: string | null;
  fundingLedgerTransactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrollJobFailureLineView = {
  itemId: string;
  itemReference: string;
  employeeAccountId: string;
  amount: string;
  currency: Currency;
  failureReason: string | null;
};

/** Read model for GET payroll completion report (terminal batches only). */
export type PayrollJobCompletionReportView = {
  jobId: string;
  batchStatus: PayrollBatchStatus;
  reference: string;
  correlationId: string | null;
  totalAmountScheduled: string;
  currency: Currency;
  lineCount: number;
  successCount: number;
  failureCount: number;
  amountSucceeded: string;
  amountFailed: string;
  failures: PayrollJobFailureLineView[];
  completedAt: string;
};

export type PayrollJobCompletionReportResult =
  | { kind: 'not_found' }
  | { kind: 'not_terminal'; batchStatus: PayrollBatchStatus }
  | { kind: 'ok'; report: PayrollJobCompletionReportView };
