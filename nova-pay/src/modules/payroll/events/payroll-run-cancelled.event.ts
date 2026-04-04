import { PayrollDomainEventName } from '../enums/payroll-domain-event-name.enum';

/**
 * Emitted when a payroll run is cancelled — outbox wiring deferred.
 */
export class PayrollRunCancelledEvent {
  constructor(
    public readonly payrollRunId: string,
    public readonly occurredAt: string,
  ) {}

  get eventName(): PayrollDomainEventName {
    return PayrollDomainEventName.RunCancelled;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      payrollRunId: this.payrollRunId,
      occurredAt: this.occurredAt,
    };
  }
}
