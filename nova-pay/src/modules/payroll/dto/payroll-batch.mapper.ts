import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { CreatePayrollBatchResult } from '../service/payroll-orchestrator.service';
import {
  CreatePayrollBatchResponseDto,
  GetPayrollBatchResponseDto,
  PayrollBatchResponseDto,
  PayrollItemResponseDto,
} from './payroll-batch-http.dto';

export function toPayrollItemResponseDto(
  i: PayrollItem,
  batchId: string,
): PayrollItemResponseDto {
  return {
    id: i.id,
    batchId,
    employeeAccountId: i.employeeAccountId,
    amount: i.amount,
    currency: i.currency,
    status: i.status,
    itemReference: i.itemReference,
    paymentId: i.paymentId,
    ledgerTransactionId: i.ledgerTransactionId,
    memo: i.memo,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

export function toPayrollBatchResponseDto(
  b: PayrollBatch,
): PayrollBatchResponseDto {
  return {
    id: b.id,
    employerAccountId: b.employerAccountId,
    totalAmount: b.totalAmount,
    currency: b.currency,
    status: b.status,
    reference: b.reference,
    idempotencyKey: b.idempotencyKey,
    correlationId: b.correlationId,
    externalBatchRef: b.externalBatchRef,
    memo: b.memo,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

export function toCreatePayrollBatchResponseDto(
  r: CreatePayrollBatchResult,
): CreatePayrollBatchResponseDto {
  return {
    batch: toPayrollBatchResponseDto(r.batch),
    items: r.items.map((i) => toPayrollItemResponseDto(i, r.batch.id)),
    created: r.created,
  };
}

export function toGetPayrollBatchResponseDto(
  batch: PayrollBatch,
  items: PayrollItem[],
): GetPayrollBatchResponseDto {
  return {
    batch: toPayrollBatchResponseDto(batch),
    items: items.map((i) => toPayrollItemResponseDto(i, batch.id)),
  };
}
