export const FRAUD_ACTION_REQUIRED_EVENT_NAME =
  'fraud.risk.action_required' as const;

export type FraudActionRequiredEventName =
  typeof FRAUD_ACTION_REQUIRED_EVENT_NAME;

/**
 * OTP / step-up challenges and similar workflows. Emit through the outbox in
 * the same transaction as the ACTION_REQUIRED risk decision; async workers
 * handle delivery; never call messaging from the synchronous fraud path here.
 */
export class FraudActionRequiredEvent {
  constructor(
    public readonly riskDecisionId: string,
    public readonly userId: string,
    public readonly paymentReference: string,
    public readonly correlationId: string,
    public readonly reasonCode: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): FraudActionRequiredEventName {
    return FRAUD_ACTION_REQUIRED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      riskDecisionId: this.riskDecisionId,
      userId: this.userId,
      paymentReference: this.paymentReference,
      correlationId: this.correlationId,
      reasonCode: this.reasonCode,
      occurredAt: this.occurredAt,
    };
  }
}
