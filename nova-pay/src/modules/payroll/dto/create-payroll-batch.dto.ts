import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Currency } from '../../accounts/enums/currency.enum';
import { CreatePayrollItemDto } from './create-payroll-item.dto';

/**
 * Create batch header + lines. `idempotencyKey` must match `Idempotency-Key`
 * header on the HTTP route when wired; stable across retries.
 */
export class CreatePayrollBatchDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'payroll-batch:2026-04:acme',
    description:
      'Per logical batch create; MUST match Idempotency-Key header when exposed',
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
    description: 'Namespace for idempotency (e.g. employer-scoped scope)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyScopeKey?: string;

  @ApiProperty({ format: 'uuid', description: 'Employer `accounts.id` debited' })
  @IsUUID('4')
  employerAccountId: string;

  @ApiProperty({
    example: '50000.0000',
    description: 'Total batch amount; must reconcile with line sums in service',
  })
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'totalAmount must be a positive decimal (up to 4 fractional places)',
  })
  totalAmount: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    maxLength: 128,
    example: 'PAYROLL-2026-W14',
    description: 'Business reference for support and reconciliation',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  reference: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Tracing id (distinct from idempotency key)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Partner or upstream payroll file id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalBatchRef?: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  memo?: string;

  @ApiProperty({
    type: CreatePayrollItemDto,
    isArray: true,
    description: 'Employee payout lines (at least one when creating with lines)',
  })
  @ValidateNested({ each: true })
  @Type(() => CreatePayrollItemDto)
  @ArrayMinSize(1)
  items: CreatePayrollItemDto[];
}
