import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { FxProvider } from '../enums/fx-provider.enum';

/**
 * Public shape returned after a rate lock is created or refreshed (no DB-only
 * columns such as user_id or provider_reference).
 */
export class FxLockResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Identifier for this lock; send as rateLockId on transfer',
  })
  @IsUUID('4')
  lockId: string;

  @ApiProperty({
    example: '0.92050000',
    description: 'Locked FX rate (product-defined quoting convention)',
  })
  @IsString()
  lockedRate: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  expiresAt: Date;

  @ApiProperty({
    minimum: 0,
    example: 295,
    description: 'Seconds until expiresAt from server evaluation time',
  })
  @IsInt()
  @Min(0)
  timeRemainingSeconds: number;

  @ApiProperty({ enum: FxProvider, example: FxProvider.INTERNAL })
  @IsEnum(FxProvider)
  provider: FxProvider;
}
