import { CreatePaymentDto } from '../../dto/create-payment.dto';

/**
 * Write-side command: submit a payment (idempotent, ledger-backed).
 */
export class CreatePaymentCommand {
  constructor(public readonly dto: CreatePaymentDto) {}
}
