import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudRuleResult } from '../enums/fraud-rule-result.enum';
import { FraudRuleType } from '../enums/fraud-rule-type.enum';

/**
 * Structured output of one rule after evaluation (before persistence).
 */
export interface FraudRuleEvaluationResult {
  readonly ruleType: FraudRuleType;
  readonly result: FraudRuleResult;
  /**
   * When TRIGGERED, the fraud stance this rule recommends for aggregation.
   * NOT_TRIGGERED may use APPROVED as neutral contribution.
   */
  readonly recommendedDecision: FraudDecisionState;
  readonly reasonCode: string;
  readonly message: string;
  readonly evidence: Record<string, unknown>;
  readonly durationMs: number;
}
