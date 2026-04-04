import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudSignal } from '../entities/fraud-signal.entity';
import { RiskDecision } from '../entities/risk-decision.entity';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudRuleResult } from '../enums/fraud-rule-result.enum';
import { FraudEvaluationContext } from '../interfaces/fraud-evaluation-context.interface';
import { FraudRuleEvaluationResult } from '../interfaces/fraud-rule-evaluation-result.interface';

export interface FraudAggregateSnapshot {
  finalDecision: FraudDecisionState;
  finalReasons: string[];
  triggeredRuleTypes: string[];
  engineMetadata: Record<string, unknown> | null;
}

/**
 * Persists every rule row plus the aggregate risk decision. No scoring logic.
 */
@Injectable()
export class FraudRuleLogService {
  constructor(
    @InjectRepository(RiskDecision)
    private readonly riskRepo: Repository<RiskDecision>,
    @InjectRepository(FraudSignal)
    private readonly signalRepo: Repository<FraudSignal>,
  ) {}

  async persistRiskDecisionAndSignals(
    ctx: FraudEvaluationContext,
    ruleResults: FraudRuleEvaluationResult[],
    aggregate: FraudAggregateSnapshot,
  ): Promise<RiskDecision> {
    const decision = this.riskRepo.create({
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
    });
    const savedDecision = await this.riskRepo.save(decision);
    const signals = ruleResults.map((r) =>
      this.signalRepo.create({
        riskDecisionId: savedDecision.id,
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
    await this.signalRepo.save(signals);
    return savedDecision;
  }
}
