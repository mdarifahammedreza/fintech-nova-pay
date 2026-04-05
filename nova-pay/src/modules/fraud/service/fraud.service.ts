import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { RiskDecision } from '../entities/risk-decision.entity';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudFlagResolvedEvent } from '../events/fraud-flag-resolved.event';
import { FraudRuleResult } from '../enums/fraud-rule-result.enum';
import { FraudRuleType } from '../enums/fraud-rule-type.enum';
import { FraudEvaluationContext } from '../interfaces/fraud-evaluation-context.interface';
import { FraudRuleEvaluationResult } from '../interfaces/fraud-rule-evaluation-result.interface';
import { RiskDecisionRepository } from '../repositories/risk-decision.repository';
import {
  FraudAggregateSnapshot,
  FraudRuleLogService,
} from './fraud-rule-log.service';
import { FraudRuleEngineService } from './fraud-rule-engine.service';

const RANK: Record<FraudDecisionState, number> = {
  [FraudDecisionState.APPROVED]: 1,
  [FraudDecisionState.REVIEW]: 2,
  [FraudDecisionState.ACTION_REQUIRED]: 3,
  [FraudDecisionState.BLOCKED]: 4,
};

/**
 * Public entry for synchronous fraud evaluation before payment approval.
 *
 * FAIL_CLOSED (fintech default): any rule ERROR, Redis/DB outage surfaced as
 * ERROR, or engine budget overrun yields a BLOCKED-leaning aggregate so we
 * never treat uncertain infrastructure as implicit approval. Money movement
 * stays with ledger/payment policy, but fraud never returns APPROVED when the
 * engine cannot prove the attempt is clean.
 */
@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    private readonly engine: FraudRuleEngineService,
    private readonly ruleLog: FraudRuleLogService,
    private readonly riskDecisionRepo: RiskDecisionRepository,
    private readonly outbox: OutboxRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Latest persisted decision for a payment reference (optional correlation).
   */
  async getRiskDecisionByReference(
    paymentReference: string,
    correlationId?: string,
  ): Promise<RiskDecision | null> {
    return this.riskDecisionRepo.findLatestByPaymentReference(
      paymentReference,
      correlationId,
    );
  }

  /**
   * Clears a BLOCKED or REVIEW decision to APPROVED and enqueues
   * `fraud.flag.resolved` in the same transaction as the UPDATE.
   */
  async resolveRiskDecision(
    riskDecisionId: string,
    resolutionNote?: string | null,
  ): Promise<RiskDecision> {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(RiskDecision, {
        where: { id: riskDecisionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new NotFoundException('Risk decision not found');
      }
      const previous = row.finalDecision;
      if (
        previous !== FraudDecisionState.BLOCKED &&
        previous !== FraudDecisionState.REVIEW
      ) {
        throw new BadRequestException(
          'Only BLOCKED or REVIEW decisions can be resolved to APPROVED',
        );
      }
      row.finalDecision = FraudDecisionState.APPROVED;
      row.engineMetadata = {
        ...(row.engineMetadata ?? {}),
        resolvedAt: new Date().toISOString(),
        previousDecision: previous,
      };
      const saved = await manager.save(RiskDecision, row);
      const occurredAt = new Date();
      const occurredIso = occurredAt.toISOString();
      const note =
        resolutionNote != null && resolutionNote.trim() !== ''
          ? resolutionNote.trim()
          : null;
      const evt = new FraudFlagResolvedEvent(
        saved.id,
        saved.userId,
        saved.paymentReference,
        saved.correlationId,
        previous,
        occurredIso,
        note,
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.FRAUD_FLAG_RESOLVED,
        correlationId: saved.correlationId,
        occurredAt,
        payload: evt.toJSON(),
      });
      return saved;
    });
  }

  async evaluateSynchronously(
    ctx: FraudEvaluationContext,
  ): Promise<RiskDecision> {
    let ruleResults: FraudRuleEvaluationResult[];
    let timedOut: boolean;
    try {
      const out = await this.engine.evaluateAll(ctx);
      ruleResults = out.results;
      timedOut = out.timedOut;
    } catch (e) {
      this.logger.error(
        `Fraud evaluation failed (fail-closed): ${
          e instanceof Error ? e.stack : e
        }`,
      );
      const synthetic = this.catastrophicRuleRows(e);
      const aggregate = this.aggregate(synthetic, false);
      const engineMetadata = {
        ...(aggregate.engineMetadata ?? {}),
        failClosed: 'CATASTROPHIC',
      };
      return await this.ruleLog.persistRiskDecisionAndSignals(ctx, synthetic, {
        ...aggregate,
        engineMetadata,
      });
    }

    let aggregate = this.aggregate(ruleResults, timedOut);
    if (!timedOut) {
      try {
        await this.engine.afterEvaluateSideEffects(ctx);
      } catch (sideErr) {
        this.logger.warn(
          `Fraud post-evaluation side effects failed: ${
            sideErr instanceof Error ? sideErr.message : sideErr
          }`,
        );
        aggregate = {
          ...aggregate,
          engineMetadata: {
            ...(aggregate.engineMetadata ?? {}),
            sideEffectsError:
              sideErr instanceof Error ? sideErr.message : String(sideErr),
          },
        };
      }
    }

    try {
      return await this.ruleLog.persistRiskDecisionAndSignals(
        ctx,
        ruleResults,
        aggregate,
      );
    } catch (persistErr) {
      this.logger.error(
        `Fraud persistence failed (not re-running catastrophic path): ${
          persistErr instanceof Error ? persistErr.stack : persistErr
        }`,
      );
      throw persistErr;
    }
  }

  /**
   * Precedence: BLOCKED > ACTION_REQUIRED > REVIEW > APPROVED. ERROR rows
   * contribute BLOCKED. NOT_TRIGGERED does not raise the decision.
   */
  private aggregate(
    results: FraudRuleEvaluationResult[],
    engineTimedOut: boolean,
  ): FraudAggregateSnapshot {
    let finalDecision = FraudDecisionState.APPROVED;
    const finalReasons: string[] = [];
    const triggeredRuleTypes: string[] = [];
    for (const r of results) {
      let contribution = FraudDecisionState.APPROVED;
      if (r.result === FraudRuleResult.ERROR) {
        contribution = FraudDecisionState.BLOCKED;
        triggeredRuleTypes.push(r.ruleType);
        finalReasons.push(`[${r.ruleType}] ${r.message}`);
      } else if (r.result === FraudRuleResult.TRIGGERED) {
        contribution = r.recommendedDecision;
        triggeredRuleTypes.push(r.ruleType);
        finalReasons.push(`[${r.ruleType}] ${r.message}`);
      }
      if (RANK[contribution] > RANK[finalDecision]) {
        finalDecision = contribution;
      }
    }
    const engineMetadata: Record<string, unknown> | null = engineTimedOut
      ? { engineTimedOut: true }
      : null;
    return {
      finalDecision,
      finalReasons,
      triggeredRuleTypes,
      engineMetadata,
    };
  }

  private catastrophicRuleRows(
    err: unknown,
  ): FraudRuleEvaluationResult[] {
    const msg = err instanceof Error ? err.message : String(err);
    const types = [
      FraudRuleType.VELOCITY,
      FraudRuleType.LARGE_TRANSACTION,
      FraudRuleType.NEW_DEVICE_LARGE_AMOUNT,
      FraudRuleType.UNUSUAL_HOUR_PATTERN,
      FraudRuleType.RECIPIENT_VELOCITY,
    ];
    return types.map((ruleType) => ({
      ruleType,
      result: FraudRuleResult.ERROR,
      recommendedDecision: FraudDecisionState.BLOCKED,
      reasonCode: 'ENGINE_FAILURE',
      message: msg,
      evidence: { phase: 'catastrophic' },
      durationMs: 0,
    }));
  }
}
