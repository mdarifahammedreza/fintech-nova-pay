import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxProcessorService } from './outbox-processor.service';

/**
 * Periodically drains the outbox via {@link OutboxProcessorService}. Disable
 * with `OUTBOX_RELAY_ENABLED=false` (e.g. tests or worker-only deployments).
 */
@Injectable()
export class OutboxRelayCronService {
  private readonly logger = new Logger(OutboxRelayCronService.name);

  constructor(
    private readonly processor: OutboxProcessorService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relayTick(): Promise<void> {
    if (this.config.get<string>('OUTBOX_RELAY_ENABLED', 'true') !== 'true') {
      return;
    }
    try {
      const limit = Number(
        this.config.get<string>('OUTBOX_RELAY_BATCH_SIZE', '50'),
      );
      await this.processor.relayPendingBatch(Number.isFinite(limit) ? limit : 50);
    } catch (err: unknown) {
      this.logger.warn(
        `Outbox relay tick failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
