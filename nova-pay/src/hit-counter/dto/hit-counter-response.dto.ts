import { ApiProperty } from '@nestjs/swagger';

export class HitCounterResponseDto {
  @ApiProperty({ example: 42, description: 'Total hits after read or write' })
  hits: number;

  @ApiProperty({
    enum: ['read', 'write'],
    example: 'read',
    description: 'Which database role served this response',
  })
  source: 'read' | 'write';
}
