import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';
import { CreatePayrollBatchResult } from '../service/payroll-orchestrator.service';

export class PayrollItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  batchId: string;

  @ApiProperty({ format: 'uuid' })
  employeeAccountId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ enum: PayrollItemStatus })
  status: PayrollItemStatus;

  @ApiProperty()
  itemReference: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  paymentId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  ledgerTransactionId: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PayrollBatchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  employerAccountId: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ enum: PayrollBatchStatus })
  status: PayrollBatchStatus;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  idempotencyKey: string;

  @ApiProperty({ nullable: true })
  correlationId: string | null;

  @ApiProperty({ nullable: true })
  externalBatchRef: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CreatePayrollBatchResponseDto {
  @ApiProperty({ type: PayrollBatchResponseDto })
  batch: PayrollBatchResponseDto;

  @ApiProperty({ type: PayrollItemResponseDto, isArray: true })
  items: PayrollItemResponseDto[];

  @ApiProperty({
    description: 'False when this idempotency key already created the batch',
  })
  created: boolean;
}

export class GetPayrollBatchResponseDto {
  @ApiProperty({ type: PayrollBatchResponseDto })
  batch: PayrollBatchResponseDto;

  @ApiProperty({ type: PayrollItemResponseDto, isArray: true })
  items: PayrollItemResponseDto[];
}

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
