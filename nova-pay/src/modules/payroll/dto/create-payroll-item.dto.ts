import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Currency } from '../../accounts/enums/currency.enum';

/**
 * One employee line for a payroll batch. itemReference is stable across retries
 * for the same logical pay line.
 */
export class CreatePayrollItemDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 128,
    example: 'emp:a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Unique within the batch; idempotent upsert key per line',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._:-]+$/, {
    message:
      'itemReference must be URL-safe (letters, digits, ., _, -, :)',
  })
  itemReference: string;

  @ApiProperty({ format: 'uuid', description: 'Credit target accounts.id' })
  @IsUUID('4')
  employeeAccountId: string;

  @ApiProperty({ example: '2500.0000', description: 'Positive gross for line' })
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'amount must be a positive decimal (up to 4 fractional places)',
  })
  amount: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  memo?: string;
}
