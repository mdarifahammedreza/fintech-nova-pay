  /**
 * Outcome of a single rule invocation (logged for every rule, every request).
 */
export enum FraudRuleResult {
  NOT_TRIGGERED = 'NOT_TRIGGERED',
  TRIGGERED = 'TRIGGERED',
  ERROR = 'ERROR',
}
