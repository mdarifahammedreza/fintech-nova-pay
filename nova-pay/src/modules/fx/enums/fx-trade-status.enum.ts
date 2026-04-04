/**
 * FX trade row lifecycle after a rate lock is applied.
 */
export enum FxTradeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
