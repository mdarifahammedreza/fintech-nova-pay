import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

/**
 * Public create payload — no `id`, timestamps, or other persistence-only
 * fields.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'Ada Lovelace', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: 'ada@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    maxLength: 255,
    description: 'Plain password; hash only in the service layer',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
