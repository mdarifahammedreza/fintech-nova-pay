import { Injectable } from '@nestjs/common';
import { FraudSignal } from '../entities/fraud-signal.entity';
import { RiskDecision } from '../entities/risk-decision.entity';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudRuleResult } from '../enums/fraud-rule-result.enum';
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
 * Persists every rule row plus the aggregate risk decision. No scoring logic.
 */
@Injectable()
export class FraudRuleLogService {
  constructor(private readonly riskRepo: RiskDecisionRepository) {}

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
    return this.riskRepo.saveWithRuleSignals(decisionProps, signalPropsList);
  }
}
