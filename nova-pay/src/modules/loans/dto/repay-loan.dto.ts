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
 * `POST /loans/:id/repay` — repayment runs as a payment from borrower wallet.
 */
export class RepayLoanDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: 'Per repayment attempt; align with `Idempotency-Key` header',
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

  @ApiProperty({ format: 'uuid', description: 'Debit `accounts.id` (wallet)' })
  @IsUUID('4')
  sourceAccountId: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/)
  amount: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  memo?: string;
}
