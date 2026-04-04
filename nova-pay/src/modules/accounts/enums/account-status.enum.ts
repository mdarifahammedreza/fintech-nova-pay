/**
 * Lifecycle / operational state of an account (not a payment status).
 */
export enum AccountStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}
