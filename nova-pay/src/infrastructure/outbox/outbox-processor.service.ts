import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitmqConfirmPublisherService } from '../messaging/rabbitmq-confirm-publisher.service';
import { OutboxRepository } from './outbox.repository';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Post-commit relay: reclaims stale `CLAIMED` rows, claims `PENDING` with
 * `SKIP LOCKED`, publishes with **broker publisher confirms**, then marks
 * `PUBLISHED` only after `waitForConfirms` succeeds.
 *
 * Stale `CLAIMED` (worker died mid-flight) is reset to `PENDING` by
 * {@link OutboxRepository.reclaimStaleClaimed}; a row may be republished.
 * Consumers must dedupe on `messageId` (outbox id) so duplicates are safe.
 */
@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly rmqConfirm: RabbitmqConfirmPublisherService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reclaims stale claims, then processes up to `limit` pending rows.
   */
  async relayPendingBatch(limit = 50): Promise<void> {
    const ttlRaw = this.config.get<string>('OUTBOX_STALE_CLAIM_SECONDS', '300');
    const ttl = Number(ttlRaw);
    const reclaimed = await this.outbox.reclaimStaleClaimed(
      Number.isFinite(ttl) ? ttl : 300,
    );
    if (reclaimed > 0) {
      this.logger.log(
        `Reclaimed ${reclaimed} stale outbox row(s) to PENDING for retry`,
      );
    }

    const retriesRaw = this.config.get<string>(
      'OUTBOX_MARK_PUBLISHED_RETRIES',
      '5',
    );
    const retryMsRaw = this.config.get<string>(
      'OUTBOX_MARK_PUBLISHED_RETRY_MS',
      '100',
    );
    const markRetries = Math.max(1, Number(retriesRaw) || 5);
    const markRetryMs = Math.max(0, Number(retryMsRaw) || 100);

    const rows = await this.outbox.claimPendingBatchForRelay(limit);
    for (const row of rows) {
      const envelope = {
        routingKey: row.routingKey,
        payload: row.payload,
        correlationId: row.correlationId ?? undefined,
        occurredAt: row.occurredAt.toISOString(),
        messageId: row.id,
      };
      try {
        await this.rmqConfirm.publishEnvelopeConfirmed(envelope);
      } catch (err: unknown) {
        this.logger.warn(
          `Outbox relay publish failed for ${row.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        const failed = await this.outbox.markFailed(row.id);
        if (!failed) {
          this.logger.warn(
            `Outbox ${row.id}: markFailed updated 0 rows (state drift)`,
          );
        }
        continue;
      }

      let lastMarkErr: unknown;
      for (let attempt = 1; attempt <= markRetries; attempt++) {
        try {
          await this.outbox.assertMarkPublishedExactlyOne(row.id);
          lastMarkErr = undefined;
          break;
        } catch (e: unknown) {
          lastMarkErr = e;
          if (attempt < markRetries) {
            await sleep(markRetryMs);
          }
        }
      }
      if (lastMarkErr !== undefined) {
        this.logger.error(
          `Outbox ${row.id}: broker confirmed publish but assertMarkPublished ` +
            `failed after ${markRetries} attempt(s) (expected affected=1); ` +
            'row stays CLAIMED until stale reclaim or manual fix; consumers ' +
            'must dedupe on messageId if republished',
          lastMarkErr instanceof Error ? lastMarkErr.stack : String(lastMarkErr),
        );
        continue;
      }
    }
  }
}
