import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Query params to read FX lock status (e.g. GET). Prefer route param for
 * lockId when the path is `/fx/locks/:lockId`; this DTO supports query-style
 * APIs as well.
 */
export class GetFxLockStatusDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Same id as lockId returned from rate lock creation',
  })
  @IsUUID('4')
  lockId: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Optional end-to-end trace id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;
}
