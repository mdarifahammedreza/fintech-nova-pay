export const FRAUD_REVIEW_TRIGGERED_EVENT_NAME =
  'fraud.risk.review_triggered' as const;

export type FraudReviewTriggeredEventName =
  typeof FRAUD_REVIEW_TRIGGERED_EVENT_NAME;

/**
 * Domain envelope for manual review queues. Persist to the outbox in the same
 * PostgreSQL transaction as the risk decision commit; consumers run only after
 * relay publish (no synchronous side effects from this class).
 */
export class FraudReviewTriggeredEvent {
  constructor(
    public readonly riskDecisionId: string,
    public readonly userId: string,
    public readonly paymentReference: string,
    public readonly correlationId: string,
    public readonly triggeredRuleTypes: string[],
    public readonly occurredAt: string,
  ) {}

  get eventName(): FraudReviewTriggeredEventName {
    return FRAUD_REVIEW_TRIGGERED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      riskDecisionId: this.riskDecisionId,
      userId: this.userId,
      paymentReference: this.paymentReference,
      correlationId: this.correlationId,
      triggeredRuleTypes: this.triggeredRuleTypes,
      occurredAt: this.occurredAt,
    };
  }
}
