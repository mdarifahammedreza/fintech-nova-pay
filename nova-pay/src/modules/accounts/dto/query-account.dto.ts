import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AccountStatus } from '../enums/account-status.enum';
import { Currency } from '../enums/currency.enum';

/**
 * List/filter accounts with pagination (read-side query).
 */
export class QueryAccountDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    example: 'ACC-10001',
    description: 'Exact account number match',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  accountNumber?: string;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ enum: AccountStatus })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
