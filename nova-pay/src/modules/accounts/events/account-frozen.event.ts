export const ACCOUNT_FROZEN_EVENT_NAME = 'account.frozen' as const;

export type AccountFrozenEventName = typeof ACCOUNT_FROZEN_EVENT_NAME;

export class AccountFrozenEvent {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly accountNumber: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): AccountFrozenEventName {
    return ACCOUNT_FROZEN_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      accountId: this.accountId,
      userId: this.userId,
      accountNumber: this.accountNumber,
      occurredAt: this.occurredAt,
    };
  }
}
