/**
 * Kind of payment instruction handled by this bounded context.
 */
export enum PaymentType {
  INTERNAL_TRANSFER = 'INTERNAL_TRANSFER',
  PAYOUT = 'PAYOUT',
  COLLECTION = 'COLLECTION',
  FEE = 'FEE',
}
