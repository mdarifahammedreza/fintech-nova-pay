import { AccountStatus } from '../enums/account-status.enum';
import { Currency } from '../enums/currency.enum';

export const ACCOUNT_CREATED_EVENT_NAME = 'account.created' as const;

export type AccountCreatedEventName = typeof ACCOUNT_CREATED_EVENT_NAME;

/** Same-transaction outbox envelope after `accounts` row insert. */
export class AccountCreatedEvent {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly accountNumber: string,
    public readonly currency: Currency,
    public readonly status: AccountStatus,
    public readonly occurredAt: string,
  ) {}

  get eventName(): AccountCreatedEventName {
    return ACCOUNT_CREATED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      accountId: this.accountId,
      userId: this.userId,
      accountNumber: this.accountNumber,
      currency: this.currency,
      status: this.status,
      occurredAt: this.occurredAt,
    };
  }
}
