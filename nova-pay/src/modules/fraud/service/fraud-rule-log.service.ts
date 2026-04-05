import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { FraudSignal } from '../entities/fraud-signal.entity';
import { RiskDecision } from '../entities/risk-decision.entity';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudRuleResult } from '../enums/fraud-rule-result.enum';
import { FraudActionRequiredEvent } from '../events/fraud-action-required.event';
import { FraudBlockedEvent } from '../events/fraud-blocked.event';
import { FraudReviewTriggeredEvent } from '../events/fraud-review-triggered.event';
import { FraudEvaluationContext } from '../interfaces/fraud-evaluation-context.interface';
import { FraudRuleEvaluationResult } from '../interfaces/fraud-rule-evaluation-result.interface';
import { RiskDecisionRepository } from '../repositories/risk-decision.repository';

export interface FraudAggregateSnapshot {
  finalDecision: FraudDecisionState;
  finalReasons: string[];
  triggeredRuleTypes: string[];
  engineMetadata: Record<string, unknown> | null;
}

/**
 * Persists rule rows + aggregate risk decision and enqueues fraud outbox rows
 * in the same PostgreSQL transaction.
 */
@Injectable()
export class FraudRuleLogService {
  constructor(
    private readonly riskRepo: RiskDecisionRepository,
    private readonly outbox: OutboxRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async persistRiskDecisionAndSignals(
    ctx: FraudEvaluationContext,
    ruleResults: FraudRuleEvaluationResult[],
    aggregate: FraudAggregateSnapshot,
  ): Promise<RiskDecision> {
    const decisionProps: Partial<RiskDecision> = {
      finalDecision: aggregate.finalDecision,
      userId: ctx.userId,
      sourceAccountId: ctx.sourceAccountId,
      destinationAccountId: ctx.destinationAccountId,
      recipientAccountId: ctx.recipientAccountId,
      senderAccountId: ctx.senderAccountId,
      amount: ctx.amount,
      currency: ctx.currency,
      paymentReference: ctx.paymentReference,
      correlationId: ctx.correlationId,
      finalReasons: aggregate.finalReasons,
      triggeredRuleTypes: aggregate.triggeredRuleTypes,
      engineMetadata: aggregate.engineMetadata,
    };
    const signalPropsList = ruleResults.map(
      (r): Partial<FraudSignal> => ({
        userId: ctx.userId,
        sourceAccountId: ctx.sourceAccountId,
        destinationAccountId: ctx.destinationAccountId,
        recipientAccountId: ctx.recipientAccountId,
        senderAccountId: ctx.senderAccountId,
        paymentReference: ctx.paymentReference,
        correlationId: ctx.correlationId,
        ruleType: r.ruleType,
        ruleResult: r.result,
        recommendedDecision:
          r.result === FraudRuleResult.ERROR
            ? FraudDecisionState.BLOCKED
            : r.recommendedDecision,
        reasonCode: r.reasonCode,
        message: r.message,
        evidence:
          r.evidence && Object.keys(r.evidence).length > 0 ? r.evidence : {},
      }),
    );

    return this.dataSource.transaction(async (manager) => {
      const saved = await this.riskRepo.saveDecisionAndSignalsInTransaction(
        manager,
        decisionProps,
        signalPropsList,
      );

      const occurredAt = new Date();
      const occurredAtIso = occurredAt.toISOString();
      const corr = saved.correlationId;

      if (saved.finalDecision === FraudDecisionState.BLOCKED) {
        const evt = new FraudBlockedEvent(
          saved.id,
          saved.userId,
          saved.paymentReference,
          corr,
          saved.triggeredRuleTypes,
          occurredAtIso,
        );
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.FRAUD_RISK_BLOCKED,
          correlationId: corr,
          occurredAt,
          payload: evt.toJSON(),
        });
      } else if (saved.finalDecision === FraudDecisionState.ACTION_REQUIRED) {
        const evt = new FraudActionRequiredEvent(
          saved.id,
          saved.userId,
          saved.paymentReference,
          corr,
          saved.finalReasons[0] ?? 'ACTION_REQUIRED',
          occurredAtIso,
        );
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.FRAUD_RISK_ACTION_REQUIRED,
          correlationId: corr,
          occurredAt,
          payload: evt.toJSON(),
        });
      } else if (saved.finalDecision === FraudDecisionState.REVIEW) {
        const evt = new FraudReviewTriggeredEvent(
          saved.id,
          saved.userId,
          saved.paymentReference,
          corr,
          saved.triggeredRuleTypes,
          occurredAtIso,
        );
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.FRAUD_RISK_REVIEW_TRIGGERED,
          correlationId: corr,
          occurredAt,
          payload: evt.toJSON(),
        });
      }

      return saved;
    });
  }
}
