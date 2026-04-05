import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * `POST /loans/:id/disburse` — body accompanies a money call through
 * {@link PaymentOrchestratorService} when implemented.
 */
export class DisburseLoanDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: 'Per disburse attempt; align with `Idempotency-Key` header',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._-]+$/)
  idempotencyKey: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyScopeKey?: string;

  @ApiProperty({
    maxLength: 128,
    description: 'Business reference on the underlying payment',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  reference: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  memo?: string;
}
