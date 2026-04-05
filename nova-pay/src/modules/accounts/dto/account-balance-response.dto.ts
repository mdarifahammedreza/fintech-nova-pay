import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../enums/currency.enum';

/** Ledger projection snapshot for GET /accounts/:id/balance. */
export class AccountBalanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  accountId: string;

  @ApiProperty({ description: 'Ledger-derived balance projection' })
  balance: string;

  @ApiProperty({ description: 'Spendable balance projection' })
  availableBalance: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({
    description: 'Last update time of the account row (projection writes)',
  })
  updatedAt: Date;
}

export type AccountBalanceView = {
  accountId: string;
  balance: string;
  availableBalance: string;
  currency: Currency;
  updatedAt: Date;
};

export function toAccountBalanceResponseDto(
  v: AccountBalanceView,
): AccountBalanceResponseDto {
  return { ...v };
}
