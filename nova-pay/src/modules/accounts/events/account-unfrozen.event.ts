export const ACCOUNT_UNFROZEN_EVENT_NAME = 'account.unfrozen' as const;

export type AccountUnfrozenEventName = typeof ACCOUNT_UNFROZEN_EVENT_NAME;

export class AccountUnfrozenEvent {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly accountNumber: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): AccountUnfrozenEventName {
    return ACCOUNT_UNFROZEN_EVENT_NAME;
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
