import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Process or fund-and-disburse a batch. idempotencyKey is per logical process
 * attempt (distinct from batch create key).
 */
export class ProcessPayrollBatchDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'payroll-process:batch-uuid:attempt-1',
    description:
      'Stable for this process operation; MUST match Idempotency-Key when wired',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._:-]+$/, {
    message:
      'idempotencyKey must be URL-safe (letters, digits, ., _, -, :)',
  })
  idempotencyKey: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Tracing id for this process call',
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
