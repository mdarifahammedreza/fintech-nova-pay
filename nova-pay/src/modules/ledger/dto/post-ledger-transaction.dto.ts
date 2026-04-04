import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Currency } from '../../accounts/enums/currency.enum';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

/**
 * One ledger line inside a posting command. No `id` or `ledgerTransactionId`
 * — the posting service assigns those when persisting.
 */
export class PostLedgerEntryLineDto {
  @ApiProperty({ format: 'uuid', description: 'Target `accounts.id`' })
  @IsUUID('4')
  accountId: string;

  @ApiProperty({ enum: LedgerEntryType, example: LedgerEntryType.DEBIT })
  @IsEnum(LedgerEntryType)
  entryType: LedgerEntryType;

  @ApiProperty({
    example: '100.0000',
    description: 'Positive magnitude; debit/credit from entryType',
  })
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'amount must be a positive decimal (up to 4 fractional places)',
  })
  amount: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Omit to let the posting service assign line order',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  lineNumber?: number;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  memo?: string;
}

/**
 * Command-shaped input to post a new ledger bundle. Status and DB ids are not
 * accepted here — the ledger service sets `POSTED` (or staging rules) after
 * validation and atomic write.
 */
export class PostLedgerTransactionDto {
  @ApiProperty({ enum: LedgerTransactionType, example: LedgerTransactionType.TRANSFER })
  @IsEnum(LedgerTransactionType)
  type: LedgerTransactionType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Set when `type` is REVERSAL (target posted transaction id)',
  })
  @IsOptional()
  @IsUUID('4')
  reversesTransactionId?: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Idempotency / tracing key from the caller',
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

  @ApiProperty({ type: PostLedgerEntryLineDto, isArray: true })
  @ValidateNested({ each: true })
  @Type(() => PostLedgerEntryLineDto)
  @ArrayMinSize(2, {
    message: 'At least two entry lines are required for a posting bundle',
  })
  entries: PostLedgerEntryLineDto[];
}
