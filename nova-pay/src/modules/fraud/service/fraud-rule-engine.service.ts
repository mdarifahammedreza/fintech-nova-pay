import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { KnownDevice } from '../entities/known-device.entity';
import { UserTransactionHourProfile } from '../entities/user-transaction-hour-profile.entity';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudRuleResult } from '../enums/fraud-rule-result.enum';
import { FraudRuleType } from '../enums/fraud-rule-type.enum';
import { FraudEvaluationContext } from '../interfaces/fraud-evaluation-context.interface';
import { FraudRuleEvaluationResult } from '../interfaces/fraud-rule-evaluation-result.interface';

const ENGINE_BUDGET_MS = 200;
const VELOCITY_WINDOW_MS = 60_000;
const VELOCITY_THRESHOLD = 5;
const LARGE_AMOUNT_USD = 10_000;
const NEW_DEVICE_AMOUNT = 500;
const UNUSUAL_HOUR_AMOUNT = 200;
const UNUSUAL_HOUR_BUCKETS = [2, 3, 4];
const RECIPIENT_WINDOW_MS = 60 * 60 * 1000;
const RECIPIENT_DISTINCT_SENDER_THRESHOLD = 20;

/**
 * Parallel synchronous rule evaluation. Redis-backed rules use ioredis sorted
 * sets explicitly via {@link RedisService.getRawClient} (ZRANGEBYSCORE-style
 * windows). When Redis is unavailable, those rules return ERROR so aggregation
 * can fail closed.
 */
@Injectable()
export class FraudRuleEngineService {
  private readonly logger = new Logger(FraudRuleEngineService.name);

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(KnownDevice)
    private readonly knownDeviceRepo: Repository<KnownDevice>,
    @InjectRepository(UserTransactionHourProfile)
    private readonly hourProfileRepo: Repository<UserTransactionHourProfile>,
  ) {}

  /**
   * Runs all five rules concurrently. Wrapped in a single budget race so the
   * hot path stays within ~200ms; on budget overrun returns synthetic ERROR
   * rows for every rule (fail closed upstream).
   */
  async evaluateAll(
    ctx: FraudEvaluationContext,
  ): Promise<FraudRuleEvaluationResult[]> {
    const run = Promise.all([
      this.ruleVelocity(ctx),
      this.ruleLargeTransaction(ctx),
      this.ruleNewDeviceLargeAmount(ctx),
      this.ruleUnusualHour(ctx),
      this.ruleRecipientVelocity(ctx),
    ]);
    return Promise.race([
      run,
      this.engineTimeoutOutcome(),
    ]);
  }

  /**
   * Idempotent side effects after rule outcomes are known: register device,
   * bump hour histogram. Does not change the already computed decision.
   */
  async afterEvaluateSideEffects(ctx: FraudEvaluationContext): Promise<void> {
    await Promise.all([
      this.registerKnownDeviceIfPresent(ctx),
      this.bumpHourHistogram(ctx),
    ]);
  }

  private async engineTimeoutOutcome(): Promise<FraudRuleEvaluationResult[]> {
    await this.delay(ENGINE_BUDGET_MS);
    this.logger.warn('Fraud engine budget exceeded; returning synthetic errors');
    const types = [
      FraudRuleType.VELOCITY,
      FraudRuleType.LARGE_TRANSACTION,
      FraudRuleType.NEW_DEVICE_LARGE_AMOUNT,
      FraudRuleType.UNUSUAL_HOUR_PATTERN,
      FraudRuleType.RECIPIENT_VELOCITY,
    ];
    return types.map((ruleType) =>
      this.errorResult(
        ruleType,
        'ENGINE_BUDGET_EXCEEDED',
        'Fraud evaluation exceeded synchronous budget (fail-closed)',
        { budgetMs: ENGINE_BUDGET_MS },
        ENGINE_BUDGET_MS,
      ),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private resolveFingerprint(ctx: FraudEvaluationContext): string | null {
    const fp = ctx.deviceFingerprint?.trim();
    if (fp) {
      return fp;
    }
    const id = ctx.deviceId?.trim();
    return id || null;
  }

  private parseAmount(amount: string): number {
    const n = Number.parseFloat(amount);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Redis sorted set per user: score = event time (ms), member = dedupe id.
   * ZREMRANGEBYSCORE prunes outside the 60s window; ZCOUNT before ZADD decides
   * if this attempt exceeds the velocity threshold.
   */
  private async ruleVelocity(
    ctx: FraudEvaluationContext,
  ): Promise<FraudRuleEvaluationResult> {
    const t0 = Date.now();
    const ruleType = FraudRuleType.VELOCITY;
    try {
      const client = this.redis.getRawClient();
      if (!client) {
        return this.errorResult(
          ruleType,
          'REDIS_DISABLED',
          'Velocity rule requires Redis',
          {},
          Date.now() - t0,
        );
      }
      const key = `fraud:velocity:z:${ctx.userId}`;
      const now = Date.now();
      const minScore = now - VELOCITY_WINDOW_MS;
      const member = `${ctx.correlationId}:${ctx.paymentReference}`;
      await client.zremrangebyscore(key, 0, minScore - 1);
      const prior = await client.zcount(key, minScore, now);
      const review = prior >= VELOCITY_THRESHOLD;
      await client.zadd(key, now, member);
      const durationMs = Date.now() - t0;
      if (review) {
        return {
          ruleType,
          result: FraudRuleResult.TRIGGERED,
          recommendedDecision: FraudDecisionState.REVIEW,
          reasonCode: 'VELOCITY_WINDOW',
          message: `More than ${VELOCITY_THRESHOLD} attempts in ${VELOCITY_WINDOW_MS}ms window`,
          evidence: { priorCount: prior, windowMs: VELOCITY_WINDOW_MS },
          durationMs,
        };
      }
      return {
        ruleType,
        result: FraudRuleResult.NOT_TRIGGERED,
        recommendedDecision: FraudDecisionState.APPROVED,
        reasonCode: 'VELOCITY_OK',
        message: 'Within velocity limits',
        evidence: { priorCount: prior, windowMs: VELOCITY_WINDOW_MS },
        durationMs,
      };
    } catch (e) {
      this.logger.warn(
        `Velocity rule failed: ${e instanceof Error ? e.message : e}`,
      );
      return this.errorResult(
        ruleType,
        'VELOCITY_ERROR',
        e instanceof Error ? e.message : String(e),
        {},
        Date.now() - t0,
      );
    }
  }

  /**
   * Thresholds assume amount is already comparable to USD; real FX belongs in
   * a dedicated normalization service.
   */
  private async ruleLargeTransaction(
    ctx: FraudEvaluationContext,
  ): Promise<FraudRuleEvaluationResult> {
    const t0 = Date.now();
    const ruleType = FraudRuleType.LARGE_TRANSACTION;
    const amt = this.parseAmount(ctx.amount);
    if (ctx.currency !== 'USD') {
      // TODO: normalize via treasury/FX service when currency !== settlement USD
    }
    if (amt > LARGE_AMOUNT_USD) {
      return {
        ruleType,
        result: FraudRuleResult.TRIGGERED,
        recommendedDecision: FraudDecisionState.ACTION_REQUIRED,
        reasonCode: 'LARGE_AMOUNT_OTP',
        message: 'Amount exceeds threshold; OTP challenge required',
        evidence: { threshold: LARGE_AMOUNT_USD, amount: ctx.amount },
        durationMs: Date.now() - t0,
      };
    }
    return {
      ruleType,
      result: FraudRuleResult.NOT_TRIGGERED,
      recommendedDecision: FraudDecisionState.APPROVED,
      reasonCode: 'LARGE_AMOUNT_OK',
      message: 'Below large-transaction threshold',
      evidence: { threshold: LARGE_AMOUNT_USD, amount: ctx.amount },
      durationMs: Date.now() - t0,
    };
  }

  /**
   * Reads device row first; only flags REVIEW when still unknown and amount
   * is high. Registers device afterward via {@link afterEvaluateSideEffects}
   * so races do not auto-clear review on the same response.
   */
  private async ruleNewDeviceLargeAmount(
    ctx: FraudEvaluationContext,
  ): Promise<FraudRuleEvaluationResult> {
    const t0 = Date.now();
    const ruleType = FraudRuleType.NEW_DEVICE_LARGE_AMOUNT;
    const fp = this.resolveFingerprint(ctx);
    if (!fp) {
      return {
        ruleType,
        result: FraudRuleResult.NOT_TRIGGERED,
        recommendedDecision: FraudDecisionState.APPROVED,
        reasonCode: 'NO_DEVICE_CONTEXT',
        message: 'No device fingerprint available for this rule',
        evidence: {},
        durationMs: Date.now() - t0,
      };
    }
    const amt = this.parseAmount(ctx.amount);
    const existing = await this.knownDeviceRepo.findOneBy({
      userId: ctx.userId,
      deviceFingerprint: fp,
    });
    if (existing) {
      return {
        ruleType,
        result: FraudRuleResult.NOT_TRIGGERED,
        recommendedDecision: FraudDecisionState.APPROVED,
        reasonCode: 'KNOWN_DEVICE',
        message: 'Device already seen for user',
        evidence: { deviceFingerprint: fp },
        durationMs: Date.now() - t0,
      };
    }
    if (amt > NEW_DEVICE_AMOUNT) {
      return {
        ruleType,
        result: FraudRuleResult.TRIGGERED,
        recommendedDecision: FraudDecisionState.REVIEW,
        reasonCode: 'NEW_DEVICE_LARGE',
        message: 'First-seen device with elevated amount',
        evidence: { deviceFingerprint: fp, threshold: NEW_DEVICE_AMOUNT },
        durationMs: Date.now() - t0,
      };
    }
    return {
      ruleType,
      result: FraudRuleResult.NOT_TRIGGERED,
      recommendedDecision: FraudDecisionState.APPROVED,
      reasonCode: 'NEW_DEVICE_SMALL_AMOUNT',
      message: 'First-seen device under amount threshold',
      evidence: { deviceFingerprint: fp, threshold: NEW_DEVICE_AMOUNT },
      durationMs: Date.now() - t0,
    };
  }

  /**
   * Uses fraud-owned hour histogram (UTC). TODO: align buckets to user locale
   * or profile timezone instead of UTC.
   */
  private async ruleUnusualHour(
    ctx: FraudEvaluationContext,
  ): Promise<FraudRuleEvaluationResult> {
    const t0 = Date.now();
    const ruleType = FraudRuleType.UNUSUAL_HOUR_PATTERN;
    const hour = ctx.transactionTimestamp.getUTCHours();
    const inWindow = UNUSUAL_HOUR_BUCKETS.includes(hour);
    const amt = this.parseAmount(ctx.amount);
    if (!inWindow || amt <= UNUSUAL_HOUR_AMOUNT) {
      return {
        ruleType,
        result: FraudRuleResult.NOT_TRIGGERED,
        recommendedDecision: FraudDecisionState.APPROVED,
        reasonCode: 'UNUSUAL_HOUR_OK',
        message: 'Outside unusual-hour window or amount below threshold',
        evidence: { hourUtc: hour, amount: ctx.amount },
        durationMs: Date.now() - t0,
      };
    }
    const rows = await this.hourProfileRepo.find({
      where: UNUSUAL_HOUR_BUCKETS.map((hourBucket) => ({
        userId: ctx.userId,
        hourBucket,
      })) as never,
    });
    let prior = 0;
    for (const r of rows) {
      prior += r.transactionCount;
    }
    if (prior === 0) {
      return {
        ruleType,
        result: FraudRuleResult.TRIGGERED,
        recommendedDecision: FraudDecisionState.REVIEW,
        reasonCode: 'UNUSUAL_HOUR_NO_HISTORY',
        message: 'No prior activity in 02:00–04:59 UTC with elevated amount',
        evidence: {
          hourUtc: hour,
          priorCountInWindow: prior,
          threshold: UNUSUAL_HOUR_AMOUNT,
        },
        durationMs: Date.now() - t0,
      };
    }
    return {
      ruleType,
      result: FraudRuleResult.NOT_TRIGGERED,
      recommendedDecision: FraudDecisionState.APPROVED,
      reasonCode: 'UNUSUAL_HOUR_HAS_HISTORY',
      message: 'User has historical activity in the unusual-hour window',
      evidence: { hourUtc: hour, priorCountInWindow: prior },
      durationMs: Date.now() - t0,
    };
  }

  /**
   * Redis ZSET per recipient: member senderId|paymentRef, score = event ms.
   * Distinct senders in the rolling hour > threshold ⇒ REVIEW (mule signal).
   */
  private async ruleRecipientVelocity(
    ctx: FraudEvaluationContext,
  ): Promise<FraudRuleEvaluationResult> {
    const t0 = Date.now();
    const ruleType = FraudRuleType.RECIPIENT_VELOCITY;
    try {
      const client = this.redis.getRawClient();
      if (!client) {
        return this.errorResult(
          ruleType,
          'REDIS_DISABLED',
          'Recipient velocity rule requires Redis',
          {},
          Date.now() - t0,
        );
      }
      const key = `fraud:recipient_velocity:z:${ctx.recipientAccountId}`;
      const now = Date.now();
      const minScore = now - RECIPIENT_WINDOW_MS;
      const member = `${ctx.senderAccountId}|${ctx.paymentReference}`;
      await client.zremrangebyscore(key, 0, minScore - 1);
      const raw = await client.zrangebyscore(key, minScore, now);
      const senders = new Set<string>();
      for (const m of raw) {
        const idx = m.indexOf('|');
        if (idx > 0) {
          senders.add(m.slice(0, idx));
        }
      }
      senders.add(ctx.senderAccountId);
      await client.zadd(key, now, member);
      await client.expire(key, 7200);
      const durationMs = Date.now() - t0;
      if (senders.size > RECIPIENT_DISTINCT_SENDER_THRESHOLD) {
        return {
          ruleType,
          result: FraudRuleResult.TRIGGERED,
          recommendedDecision: FraudDecisionState.REVIEW,
          reasonCode: 'RECIPIENT_MULE_VELOCITY',
          message: 'Recipient inbound velocity from many distinct senders',
          evidence: {
            distinctSenders: senders.size,
            threshold: RECIPIENT_DISTINCT_SENDER_THRESHOLD,
            windowMs: RECIPIENT_WINDOW_MS,
          },
          durationMs,
        };
      }
      return {
        ruleType,
        result: FraudRuleResult.NOT_TRIGGERED,
        recommendedDecision: FraudDecisionState.APPROVED,
        reasonCode: 'RECIPIENT_VELOCITY_OK',
        message: 'Recipient inbound sender diversity within limits',
        evidence: {
          distinctSenders: senders.size,
          threshold: RECIPIENT_DISTINCT_SENDER_THRESHOLD,
        },
        durationMs,
      };
    } catch (e) {
      this.logger.warn(
        `Recipient velocity failed: ${e instanceof Error ? e.message : e}`,
      );
      return this.errorResult(
        ruleType,
        'RECIPIENT_VELOCITY_ERROR',
        e instanceof Error ? e.message : String(e),
        {},
        Date.now() - t0,
      );
    }
  }

  private async registerKnownDeviceIfPresent(
    ctx: FraudEvaluationContext,
  ): Promise<void> {
    const fp = this.resolveFingerprint(ctx);
    if (!fp) {
      return;
    }
    const now = new Date();
    const existing = await this.knownDeviceRepo.findOneBy({
      userId: ctx.userId,
      deviceFingerprint: fp,
    });
    if (existing) {
      existing.lastSeenAt = now;
      existing.deviceId = ctx.deviceId?.trim() || existing.deviceId;
      await this.knownDeviceRepo.save(existing);
      return;
    }
    await this.knownDeviceRepo.save(
      this.knownDeviceRepo.create({
        userId: ctx.userId,
        deviceId: ctx.deviceId?.trim() || null,
        deviceFingerprint: fp,
        metadata: null,
        firstSeenAt: now,
        lastSeenAt: now,
      }),
    );
  }

  private async bumpHourHistogram(ctx: FraudEvaluationContext): Promise<void> {
    const hour = ctx.transactionTimestamp.getUTCHours();
    const now = new Date();
    let row = await this.hourProfileRepo.findOneBy({
      userId: ctx.userId,
      hourBucket: hour,
    });
    if (!row) {
      row = this.hourProfileRepo.create({
        userId: ctx.userId,
        hourBucket: hour,
        transactionCount: 0,
        lastIncrementAt: null,
      });
    }
    row.transactionCount += 1;
    row.lastIncrementAt = now;
    await this.hourProfileRepo.save(row);
  }

  private errorResult(
    ruleType: FraudRuleType,
    reasonCode: string,
    message: string,
    evidence: Record<string, unknown>,
    durationMs: number,
  ): FraudRuleEvaluationResult {
    return {
      ruleType,
      result: FraudRuleResult.ERROR,
      recommendedDecision: FraudDecisionState.BLOCKED,
      reasonCode,
      message,
      evidence,
      durationMs,
    };
  }
}
