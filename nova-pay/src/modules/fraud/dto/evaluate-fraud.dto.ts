import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Currency } from '../../accounts/enums/currency.enum';

/**
 * Ensures at least one of deviceId / deviceFingerprint is present for device
 * and velocity-related rules.
 */
@ValidatorConstraint({ name: 'fraudDeviceContext', async: false })
class FraudDeviceContextConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const o = args.object as EvaluateFraudDto;
    const id = o.deviceId?.trim();
    const fp = o.deviceFingerprint?.trim();
    return Boolean(id || fp);
  }

  defaultMessage(): string {
    return 'Provide deviceId and/or deviceFingerprint (at least one non-empty)';
  }
}

/**
 * Body for synchronous fraud evaluation. Callers pass denormalized facts;
 * fraud does not read ledger tables from here.
 */
export class EvaluateFraudDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  userId: string;

  @ApiProperty({ format: 'uuid', description: 'Debit / source account' })
  @IsUUID('4')
  sourceAccountId: string;

  @ApiProperty({ format: 'uuid', description: 'Credit / destination account' })
  @IsUUID('4')
  destinationAccountId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Inbound side of the transfer (mule / recipient rules)',
  })
  @IsUUID('4')
  recipientAccountId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Outbound sender account for the movement',
  })
  @IsUUID('4')
  senderAccountId: string;

  @ApiProperty({
    example: '100.0000',
    description:
      'Amount as decimal string; assume comparable to USD for rule ' +
      'thresholds unless FX normalization is added',
  })
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'amount must be a positive decimal (up to 4 fractional places)',
  })
  amount: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({
    maxLength: 128,
    example: 'PAY-2026-00042',
    description: 'Idempotent business reference for this payment attempt',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  paymentReference: string;

  @ApiProperty({
    maxLength: 128,
    example: 'req-7c9e2b1a',
    description: 'End-to-end trace id for this evaluation',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  correlationId: string;

  @ApiPropertyOptional({
    maxLength: 256,
    description: 'Client-reported device id when available',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  deviceId?: string;

  @ApiPropertyOptional({
    maxLength: 512,
    description: 'Stronger device fingerprint when available',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  deviceFingerprint?: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the payment is attempted (rules / hour windows)',
  })
  @Type(() => Date)
  @IsDate()
  @Validate(FraudDeviceContextConstraint)
  transactionTimestamp: Date;
}
