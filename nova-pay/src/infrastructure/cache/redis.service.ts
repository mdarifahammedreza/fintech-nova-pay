import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Generic Redis access for cache, rate limits, counters, etc.
 * **Not** financial source of truth — no domain rules here.
 *
 * Disabled when `REDIS_URL` is unset; all methods become safe no-ops or
 * return null where documented.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('REDIS_URL')?.trim();
    this.client = url
      ? new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        })
      : null;
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.log('Redis disabled (no REDIS_URL)');
      return;
    }
    try {
      await this.client.connect();
      this.logger.log('Redis connected');
    } catch (e) {
      this.logger.warn(
        `Redis connect failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    return this.client.get(key);
  }

  /**
   * @param ttlSeconds optional TTL (SET EX)
   */
  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!this.client) {
      return;
    }
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.client.set(key, value);
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.client || keys.length === 0) {
      return 0;
    }
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    const n = await this.client.exists(key);
    return n === 1;
  }

  /** Redis TTL seconds, or null if disabled / missing key. */
  async ttl(key: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    const t = await this.client.ttl(key);
    return t;
  }

  async incr(key: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number | null> {
    if (!this.client) {
      return null;
    }
    return this.client.decr(key);
  }

  /** SET if absent — useful for idempotent locks / rate windows. */
  async setNx(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    if (ttlSeconds !== undefined) {
      const r = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return r === 'OK';
    }
    const r = await this.client.set(key, value, 'NX');
    return r === 'OK';
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    const n = await this.client.expire(key, ttlSeconds);
    return n === 1;
  }

  /** Raw client for advanced pipelines — use rarely; prefer methods above. */
  getRawClient(): Redis | null {
    return this.client;
  }
}
