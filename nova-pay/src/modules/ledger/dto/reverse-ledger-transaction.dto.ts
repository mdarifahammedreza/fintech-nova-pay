import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Idempotency / tracing key for the reversal attempt',
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
