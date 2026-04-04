import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * Optional Redis connectivity (enabled only when `REDIS_URL` is set).
 * Import where cache, rate limiting, or counters are needed — keep domain
 * modules thin; wrap Redis behind application services when rules apply.
 */
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
