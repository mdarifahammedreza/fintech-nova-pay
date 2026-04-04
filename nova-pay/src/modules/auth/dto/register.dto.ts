import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Self-service signup payload. Maps to users module via
 * {@link UsersService} (e.g. default `USER` role applied in auth service).
 */
export class RegisterDto {
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
  })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password: string;
}
