import { CreatePaymentDto } from '../../dto/create-payment.dto';

/**
 * Write-side command: submit a payment (idempotent, ledger-backed).
 * `actorUserId` is JWT `sub`; never from the client body.
 */
export class CreatePaymentCommand {
  constructor(
    public readonly dto: CreatePaymentDto,
    public readonly actorUserId: string,
  ) {}
}
