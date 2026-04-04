import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 255 })
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
