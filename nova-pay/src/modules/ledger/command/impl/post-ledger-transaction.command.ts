import { PostLedgerTransactionDto } from '../../dto/post-ledger-transaction.dto';

/**
 * Write-side command: post a balanced ledger bundle (one header + N lines).
 */
export class PostLedgerTransactionCommand {
  constructor(public readonly dto: PostLedgerTransactionDto) {}
}
