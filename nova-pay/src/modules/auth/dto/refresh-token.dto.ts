import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description:
      'Opaque refresh token issued at login; verify by hash against DB',
    minLength: 16,
    maxLength: 2048,
  })
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  refreshToken: string;
}
