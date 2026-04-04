import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HitCounterResponseDto } from './dto/hit-counter-response.dto';
import { HitCounterService } from './hit-counter.service';

@ApiTags('hits')
@Controller('hits')
export class HitCounterController {
  constructor(private readonly hitCounterService: HitCounterService) {}

  @Get()
  @ApiOperation({
    summary: 'Get hit count (read replica)',
    description:
      'Runs a SELECT on the read Postgres connection (streaming replica).',
  })
  @ApiOkResponse({ type: HitCounterResponseDto })
  getHits(): Promise<HitCounterResponseDto> {
    return this.hitCounterService.getHits();
  }

  @Post('increment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Increment hit count (primary)',
    description:
      'Atomically increments on the write Postgres connection (primary).',
  })
  @ApiOkResponse({ type: HitCounterResponseDto })
  increment(): Promise<HitCounterResponseDto> {
    return this.hitCounterService.incrementHits();
  }
}
