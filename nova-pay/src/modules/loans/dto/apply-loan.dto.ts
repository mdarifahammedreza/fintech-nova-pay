import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Currency } from '../../accounts/enums/currency.enum';

/**
 * `POST /loans/apply` — non-money intake; idempotency prevents duplicate
 * applications (persist `(applyIdempotencyKey, scope)` like payments).
 */
export class ApplyLoanDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description:
      'Stable per logical apply; should match `Idempotency-Key` header when wired',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._-]+$/)
  applyIdempotencyKey: string;

  @ApiPropertyOptional({ maxLength: 128, default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  applyIdempotencyScopeKey?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  borrowerUserId: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/)
  principalAmount: string;

  @ApiProperty({ enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Borrower wallet `accounts.id` for future disburse',
  })
  @IsOptional()
  @IsUUID('4')
  borrowerWalletAccountId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Internal pool account to debit on disburse (`accounts.id`)',
  })
  @IsOptional()
  @IsUUID('4')
  loanFundingAccountId?: string;

  @ApiPropertyOptional({ description: 'Annualized rate in basis points' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  interestRateBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  termMonths?: number;

  @ApiPropertyOptional({
    description: 'Loan maturity (UTC). Drives overdue sweeps when `ACTIVE`',
  })
  @IsOptional()
  @IsDateString()
  maturityDate?: string;
}
