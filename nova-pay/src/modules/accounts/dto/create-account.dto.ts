import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { AccountStatus } from '../enums/account-status.enum';
import { Currency } from '../enums/currency.enum';

/**
 * Create payload — no `id`, balances, or timestamps (balances are projections).
 */
export class CreateAccountDto {
  @ApiProperty({ format: 'uuid', description: 'Owner user id (`users.id`)' })
  @IsUUID('4')
  userId: string;

  @ApiProperty({ example: 'ACC-10001', maxLength: 32 })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  accountNumber: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({
    enum: AccountStatus,
    default: AccountStatus.PENDING,
    description: 'Initial status; defaults at persistence if omitted',
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @ApiPropertyOptional({
    example: '0.0000',
    description: 'Max overdraft in account currency (decimal string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'overdraftLimit must be a non-negative decimal (up to 4 places)',
  })
  overdraftLimit?: string;
}
