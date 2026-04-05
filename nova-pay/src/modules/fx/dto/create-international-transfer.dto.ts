import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Initiates a cross-border / FX-backed transfer using a prior rate lock.
 * Aligns with payment idempotency: same key + payload on retries.
 */
export class CreateInternationalTransferDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'fx-tx-7c9e2b1a-0001',
    description:
      'Client unique key per logical transfer; SHOULD match Idempotency-Key ' +
      'header when used with HTTP',
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
    description: 'Optional namespace for idempotency (e.g. user-scoped slot)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyScopeKey?: string;

  @ApiProperty({
    maxLength: 128,
    example: 'INTL-2026-0042',
    description: 'Business reference for reconciliation (not the idempotency key)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  reference: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Tracing id distinct from idempotencyKey',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;

  @ApiProperty({ format: 'uuid', description: 'Debit account' })
  @IsUUID('4')
  sourceAccountId: string;

  @ApiProperty({ format: 'uuid', description: 'Credit account' })
  @IsUUID('4')
  destinationAccountId: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'ACTIVE lock id from `POST /fx/lock-rate`; must still be within its 60s TTL ' +
      '(`expiresAt` not passed)',
  })
  @IsUUID('4')
  rateLockId: string;

  @ApiProperty({
    example: '1000.0000',
    description: 'Amount to move in source leg (must match lock terms)',
  })
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'amount must be a positive decimal (up to 4 fractional places)',
  })
  amount: string;
}
