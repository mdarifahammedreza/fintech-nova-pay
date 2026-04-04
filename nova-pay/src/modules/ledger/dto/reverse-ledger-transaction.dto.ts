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
 * Intent to reverse a **posted** ledger transaction. The ledger service loads
 * the original bundle, builds compensating lines, and persists a new
 * `LedgerTransaction` (type `REVERSAL`) — this DTO never carries raw entry
 * rows so business rules stay centralized.
 */
export class ReverseLedgerTransactionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Id of the posted `LedgerTransaction` to reverse',
  })
  @IsUUID('4')
  originalLedgerTransactionId: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'reversal:tx-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Required idempotency key for this reversal; stable across retries.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._:-]+$/, {
    message:
      'correlationId must be URL-safe (letters, digits, ., _, -, :)',
  })
  correlationId: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  memo?: string;
}
