import { ReverseLedgerTransactionDto } from '../../dto/reverse-ledger-transaction.dto';

/**
 * Write-side command: compensating reversal for a posted transaction.
 */
export class ReverseLedgerTransactionCommand {
  constructor(public readonly dto: ReverseLedgerTransactionDto) {}
}
