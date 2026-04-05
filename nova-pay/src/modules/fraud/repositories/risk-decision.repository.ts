import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { FraudSignal } from '../entities/fraud-signal.entity';
import { RiskDecision } from '../entities/risk-decision.entity';

/** `fraud_risk_decisions` persistence. */
@Injectable()
export class RiskDecisionRepository extends BaseRepository<RiskDecision> {
  constructor(
    @InjectRepository(RiskDecision)
    repository: Repository<RiskDecision>,
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
   * Inserts one risk decision and related signal rows using the caller’s
   * transaction. Caller owns outbox and transaction boundaries.
   */
  async saveDecisionAndSignalsInTransaction(
    manager: EntityManager,
    decisionProps: DeepPartial<RiskDecision>,
    signalPropsList: DeepPartial<FraudSignal>[],
  ): Promise<RiskDecision> {
    const dr = manager.getRepository(RiskDecision);
    const sr = manager.getRepository(FraudSignal);
    const decision = dr.create(decisionProps as RiskDecision);
    const saved = await dr.save(decision);
    const signals = signalPropsList.map((p) =>
      sr.create({
        ...p,
        riskDecisionId: saved.id,
      } as FraudSignal),
    );
    await sr.save(signals);
    return saved;
  }
}
