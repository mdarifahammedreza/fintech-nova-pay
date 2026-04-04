import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';

/**
 * List or filter payroll batches (read side; no idempotency on queries).
 */
export class QueryPayrollBatchDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Restrict to batches for this employer account',
  })
  @IsOptional()
  @IsUUID('4')
  employerAccountId?: string;

  @ApiPropertyOptional({ enum: PayrollBatchStatus })
  @IsOptional()
  @IsEnum(PayrollBatchStatus)
  status?: PayrollBatchStatus;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Exact business reference match',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;
}
