/**
 * Terminal / actionable outcome of a synchronous fraud evaluation.
 * ACTION_REQUIRED: e.g. OTP challenge for large amount (not auto-approved).
 */
export enum FraudDecisionState {
  APPROVED = 'APPROVED',
  REVIEW = 'REVIEW',
  BLOCKED = 'BLOCKED',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
}
