/**
 * Built-in synchronous rules executed in parallel by the fraud rule engine.
 */
export enum FraudRuleType {
  VELOCITY = 'VELOCITY',
  LARGE_TRANSACTION = 'LARGE_TRANSACTION',
  NEW_DEVICE_LARGE_AMOUNT = 'NEW_DEVICE_LARGE_AMOUNT',
  UNUSUAL_HOUR_PATTERN = 'UNUSUAL_HOUR_PATTERN',
  RECIPIENT_VELOCITY = 'RECIPIENT_VELOCITY',
}
