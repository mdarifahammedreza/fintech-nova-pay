import { OmitType } from '@nestjs/swagger';
import { ReverseLedgerTransactionDto } from '../../ledger/dto/reverse-ledger-transaction.dto';

/**
 * Body for `POST /transactions/:id/reverse`; `:id` is the ledger tx to reverse.
 */
export class ReverseTransactionBodyDto extends OmitType(
  ReverseLedgerTransactionDto,
  ['originalLedgerTransactionId'] as const,
) {}
