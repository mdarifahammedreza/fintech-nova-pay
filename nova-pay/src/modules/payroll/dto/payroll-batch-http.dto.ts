import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';

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
