import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { paymentLedgerCorrelationId } from '../constants/payment-ledger-link.constants';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: PaymentType })
  type: PaymentType;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty()
  reference: string;

  @ApiProperty({ format: 'uuid' })
  idempotencyRecordId: string;

  @ApiProperty({ format: 'uuid' })
  sourceAccountId: string;

  @ApiProperty({ format: 'uuid' })
  destinationAccountId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description:
      'Posted `ledger_transactions.id` after a successful money path. ' +
      'When set, fetch the immutable line bundle with ' +
      '`GET /ledger/transactions/{ledgerTransactionId}` (ledger is source of truth for entries).',
  })
  ledgerTransactionId: string | null;

  @ApiProperty({
    description:
      'Ledger header `correlationId` for this payment’s primary posting ' +
      '(always `payment:{paymentId}`). Matches rows returned from the ledger API ' +
      'for that transaction; use `ledgerTransactionId` when present for the stable id.',
    example: 'payment:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  paymentLedgerCorrelationId: string;

  @ApiProperty({
    nullable: true,
    description:
      'Optional API tracing id (distinct from idempotency key and from ledger correlation).',
  })
  correlationId: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export function toPaymentResponse(p: Payment): PaymentResponseDto {
  return {
    id: p.id,
    type: p.type,
    status: p.status,
    reference: p.reference,
    idempotencyRecordId: p.idempotencyRecordId,
    sourceAccountId: p.sourceAccountId,
    destinationAccountId: p.destinationAccountId,
    amount: p.amount,
    currency: p.currency,
    ledgerTransactionId: p.ledgerTransactionId,
    paymentLedgerCorrelationId: paymentLedgerCorrelationId(p.id),
    correlationId: p.correlationId,
    memo: p.memo,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
