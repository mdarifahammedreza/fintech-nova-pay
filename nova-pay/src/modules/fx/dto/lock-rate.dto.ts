import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Currency } from '../../accounts/enums/currency.enum';

@ValidatorConstraint({ name: 'fxDistinctCurrencies', async: false })
class FxDistinctCurrenciesConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const o = args.object as LockRateDto;
    return o.sourceCurrency !== o.targetCurrency;
  }

  defaultMessage(): string {
    return 'sourceCurrency and targetCurrency must differ';
  }
}

/**
 * Request body to obtain a time-bounded FX quote lock (no ledger movement).
 * The server sets lock expiry to **60 seconds** after the row is created.
 */
export class LockRateDto {
  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  sourceCurrency: Currency;

  @ApiProperty({ enum: Currency, example: Currency.EUR })
  @IsEnum(Currency)
  @Validate(FxDistinctCurrenciesConstraint)
  targetCurrency: Currency;

  @ApiProperty({
    example: '1000.0000',
    description: 'Positive amount in source currency (up to 4 decimal places)',
  })
  @IsString()
  @Matches(/^\d{1,15}(\.\d{1,4})?$/, {
    message: 'sourceAmount must be a positive decimal (up to 4 fractional places)',
  })
  sourceAmount: string;
}
