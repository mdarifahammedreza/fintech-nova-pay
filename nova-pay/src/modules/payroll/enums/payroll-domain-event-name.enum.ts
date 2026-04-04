/**
 * Domain event name constants for payroll outbox / consumers (wire payloads later).
 */
export enum PayrollDomainEventName {
  RunSubmitted = 'payroll.run.submitted',
  RunCancelled = 'payroll.run.cancelled',
}
