import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { FraudSignal } from '../entities/fraud-signal.entity';
import { RiskDecision } from '../entities/risk-decision.entity';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudActionRequiredEvent } from '../events/fraud-action-required.event';
import { FraudBlockedEvent } from '../events/fraud-blocked.event';
import { FraudReviewTriggeredEvent } from '../events/fraud-review-triggered.event';

/** `fraud_risk_decisions` persistence. */
@Injectable()
export class RiskDecisionRepository extends BaseRepository<RiskDecision> {
  constructor(
    @InjectRepository(RiskDecision)
    repository: Repository<RiskDecision>,
    private readonly outbox: OutboxRepository,
  ) {
    super(repository);
  }

  findLatestByPaymentReference(
    paymentReference: string,
    correlationId?: string,
  ): Promise<RiskDecision | null> {
    const where: FindOptionsWhere<RiskDecision> = { paymentReference };
    if (correlationId !== undefined && correlationId !== '') {
      where.correlationId = correlationId;
    }
    return this.findOne({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Single transaction: one risk decision row + all per-rule signal rows.
   */
  async saveWithRuleSignals(
    decisionProps: DeepPartial<RiskDecision>,
    signalPropsList: DeepPartial<FraudSignal>[],
  ): Promise<RiskDecision> {
    return this.repository.manager.transaction(async (em) => {
      const dr = em.getRepository(RiskDecision);
      const sr = em.getRepository(FraudSignal);
      const decision = dr.create(decisionProps as RiskDecision);
      const saved = await dr.save(decision);
      const signals = signalPropsList.map((p) =>
        sr.create({
          ...p,
          riskDecisionId: saved.id,
        } as FraudSignal),
      );
      await sr.save(signals);

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
        await this.outbox.enqueueInTransaction(em, {
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
        await this.outbox.enqueueInTransaction(em, {
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
        await this.outbox.enqueueInTransaction(em, {
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
