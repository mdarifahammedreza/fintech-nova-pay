import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { LoanStatus } from '../enums/loan-status.enum';

/** HTTP read shape — mirrors {@link Loan} projection fields. */
export class LoanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  borrowerUserId: string;

  @ApiProperty({ enum: LoanStatus })
  status: LoanStatus;

  @ApiProperty()
  principalAmount: string;

  @ApiProperty()
  outstandingPrincipal: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiPropertyOptional({ format: 'uuid' })
  borrowerWalletAccountId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  loanFundingAccountId?: string | null;

  @ApiPropertyOptional()
  interestRateBps?: number | null;

  @ApiPropertyOptional()
  termMonths?: number | null;

  @ApiPropertyOptional()
  maturityDate?: Date | null;

  @ApiPropertyOptional({ format: 'uuid' })
  disbursementPaymentId?: string | null;

  @ApiPropertyOptional()
  disbursementCorrelationId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  lastRepaymentPaymentId?: string | null;

  @ApiPropertyOptional()
  approvedAt?: Date | null;

  @ApiPropertyOptional()
  disbursedAt?: Date | null;

  @ApiPropertyOptional()
  closedAt?: Date | null;

  @ApiPropertyOptional()
  rejectedAt?: Date | null;

  @ApiPropertyOptional()
  markedOverdueAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
