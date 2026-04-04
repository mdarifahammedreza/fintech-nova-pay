/**
 * Rate lock lifecycle. A lock moves to CONSUMED exactly once when tied to a
 * trade; EXPIRED/CANCELLED are terminal without consumption.
 */
export enum FxLockStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CONSUMED = 'CONSUMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
