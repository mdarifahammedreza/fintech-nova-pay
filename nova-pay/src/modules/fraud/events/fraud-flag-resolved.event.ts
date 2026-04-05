import { FraudDecisionState } from '../enums/fraud-decision-state.enum';

export const FRAUD_FLAG_RESOLVED_EVENT_NAME = 'fraud.flag.resolved' as const;

export type FraudFlagResolvedEventName = typeof FRAUD_FLAG_RESOLVED_EVENT_NAME;

/**
 * Emitted when a persisted risk decision is cleared to APPROVED after BLOCKED
 * or REVIEW. Outbox row in same transaction as the UPDATE only.
 */
export class FraudFlagResolvedEvent {
  constructor(
    public readonly riskDecisionId: string,
    public readonly userId: string,
    public readonly paymentReference: string,
    public readonly correlationId: string,
    public readonly previousDecision: FraudDecisionState,
    public readonly occurredAt: string,
    public readonly resolutionNote: string | null,
  ) {}

  get eventName(): FraudFlagResolvedEventName {
    return FRAUD_FLAG_RESOLVED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      riskDecisionId: this.riskDecisionId,
      userId: this.userId,
      paymentReference: this.paymentReference,
      correlationId: this.correlationId,
      previousDecision: this.previousDecision,
      occurredAt: this.occurredAt,
      resolutionNote: this.resolutionNote,
    };
  }
}
