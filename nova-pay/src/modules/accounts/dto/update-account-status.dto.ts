import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AccountStatus } from '../enums/account-status.enum';

/**
 * Status transition input only — no balance or projection fields.
 */
export class UpdateAccountStatusDto {
  @ApiProperty({ enum: AccountStatus, example: AccountStatus.ACTIVE })
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
