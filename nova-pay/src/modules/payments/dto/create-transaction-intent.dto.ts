import { OmitType } from '@nestjs/swagger';
import { CreatePaymentDto } from './create-payment.dto';

/**
 * Shared body for `/transactions/*` payment-backed routes (type chosen by path).
 */
export class CreateTransactionIntentDto extends OmitType(CreatePaymentDto, [
  'type',
] as const) {}
