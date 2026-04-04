import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Currency } from '../../accounts/enums/currency.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';

/**
 * List/filter payments with pagination (read-side query).
 */
export class QueryPaymentDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentType })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ maxLength: 128, description: 'Exact reference match' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  reference?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sourceAccountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  destinationAccountId?: string;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}
