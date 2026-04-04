import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Currency } from '../../accounts/enums/currency.enum';
import { PaymentType } from '../enums/payment-type.enum';

/**
 * Create-payment body. Retries must send the **same** `idempotencyKey` (and
 * normally the same payload) so duplicate money movement is not created.
 * `status`, `id`, `ledgerTransactionId`, and timestamps are assigned server-side.
 */
export class CreatePaymentDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Client-generated unique key per logical payment attempt; MUST match ' +
      'the `Idempotency-Key` HTTP header exactly and stay stable across retries',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'idempotencyKey must be URL-safe (letters, digits, ., _, -) for header transport',
  })
  idempotencyKey: string;

  @ApiPropertyOptional({
    maxLength: 128,
    default: '',
    description:
      'Namespace for the key (e.g. `user:<uuid>`). Omit or empty for a single global namespace',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyScopeKey?: string;

  @ApiProperty({ enum: PaymentType, example: PaymentType.INTERNAL_TRANSFER })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({
    maxLength: 128,
    description: 'Business reference for reconciliation (not the idempotency key)',
    example: 'INV-2026-0042',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  reference: string;

  @ApiProperty({ format: 'uuid', description: 'Debit/source `accounts.id`' })
  @IsUUID('4')
  sourceAccountId: string;

  @ApiProperty({ format: 'uuid', description: 'Credit/destination `accounts.id`' })
  @IsUUID('4')
  destinationAccountId: string;

  @ApiProperty({ example: '100.0000', description: 'Positive amount string' })
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'amount must be a positive decimal (up to 4 fractional places)',
  })
  amount: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Optional tracing id (distinct from idempotency key)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  memo?: string;
}
