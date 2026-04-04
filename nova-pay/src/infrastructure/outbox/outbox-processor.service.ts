import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { RabbitmqService } from '../messaging/rabbitmq.service';
import { OutboxRepository } from './outbox.repository';

/**
 * Post-commit relay: reads `PENDING` outbox rows and publishes to RabbitMQ.
 * Do **not** invoke from HTTP controllers. Wire to a cron/worker/queue consumer
 * in application bootstrap when ready.
 *
 * TODO: Use `SELECT … FOR UPDATE SKIP LOCKED` when multiple relay workers run.
 */
@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly rmq: RabbitmqService,
  ) {}

  /**
   * Processes up to `limit` pending rows. Each row is published only after
   * the domain transaction that created it has committed (relay runs later).
   */
  async relayPendingBatch(limit = 50): Promise<void> {
    const rows = await this.outbox.findOldestPending(limit);
    for (const row of rows) {
      try {
        await firstValueFrom(
          this.rmq.publish$({
            routingKey: row.routingKey,
            payload: row.payload,
            correlationId: row.correlationId ?? undefined,
            occurredAt: row.occurredAt.toISOString(),
            messageId: row.id,
          }),
        );
        await this.outbox.markPublished(row.id);
      } catch (err: unknown) {
        this.logger.warn(
          `Outbox relay failed for ${row.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        await this.outbox.markFailed(row.id);
      }
    }
  }
}
