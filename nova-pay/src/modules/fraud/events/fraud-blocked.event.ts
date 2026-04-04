export const FRAUD_BLOCKED_EVENT_NAME = 'fraud.risk.blocked' as const;

export type FraudBlockedEventName = typeof FRAUD_BLOCKED_EVENT_NAME;

/**
 * Notifies downstream policy or support when a decision blocks progression.
 * Outbox-only: write with the risk decision in one DB transaction, publish via
 * relay after commit.
 */
export class FraudBlockedEvent {
  constructor(
    public readonly riskDecisionId: string,
    public readonly userId: string,
    public readonly paymentReference: string,
    public readonly correlationId: string,
    public readonly triggeredRuleTypes: string[],
    public readonly occurredAt: string,
  ) {}

  get eventName(): FraudBlockedEventName {
    return FRAUD_BLOCKED_EVENT_NAME;
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
