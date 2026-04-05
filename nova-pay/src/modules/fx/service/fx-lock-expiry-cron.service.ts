import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FxLockExpirySweepService } from './fx-lock-expiry-sweep.service';

/**
 * Periodic sweep for expired FX rate locks. Disable with
 * `FX_LOCK_EXPIRY_SWEEP_ENABLED=false`.
 */
@Injectable()
export class FxLockExpiryCronService {
  private readonly logger = new Logger(FxLockExpiryCronService.name);

  constructor(
    private readonly sweep: FxLockExpirySweepService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    if (this.config.get<string>('FX_LOCK_EXPIRY_SWEEP_ENABLED', 'true') !== 'true') {
      return;
    }
    try {
      const raw = this.config.get<string>('FX_LOCK_EXPIRY_BATCH_SIZE', '50');
      const limit = Number(raw);
      await this.sweep.sweepExpiredLocks(Number.isFinite(limit) ? limit : 50);
    } catch (err: unknown) {
      this.logger.warn(
        `FX lock expiry sweep failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
