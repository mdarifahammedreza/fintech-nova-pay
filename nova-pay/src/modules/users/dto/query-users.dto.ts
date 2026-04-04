import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { UserRole } from '../enums/user-role.enum';

/**
 * List/filter users with pagination (read-side query).
 */
export class QueryUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'ada@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Case-sensitive substring match on full name',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
