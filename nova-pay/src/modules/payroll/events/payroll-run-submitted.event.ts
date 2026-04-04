import { PayrollDomainEventName } from '../enums/payroll-domain-event-name.enum';

/**
 * Emitted when a payroll run is submitted — outbox wiring deferred.
 */
export class PayrollRunSubmittedEvent {
  constructor(
    public readonly payrollRunId: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): PayrollDomainEventName {
    return PayrollDomainEventName.RunSubmitted;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      payrollRunId: this.payrollRunId,
      occurredAt: this.occurredAt,
    };
  }
}
