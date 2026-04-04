import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Query params to load a persisted synchronous risk decision by payment
 * reference (primary key for reconciliation). Optional correlation narrows
 * or disambiguates when references repeat across environments.
 */
export class QueryRiskDecisionDto {
  @ApiProperty({
    maxLength: 128,
    example: 'PAY-2026-00042',
    description: 'Business payment reference from the evaluation',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  paymentReference: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Optional correlation id from the evaluation',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  correlationId?: string;
}
