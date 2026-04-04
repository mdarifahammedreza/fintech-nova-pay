import { Injectable } from '@nestjs/common';
import { LedgerTransaction } from '../../entities/ledger-transaction.entity';
import { ReversalService } from '../../service/reversal.service';
import { ReverseLedgerTransactionCommand } from '../impl/reverse-ledger-transaction.command';

@Injectable()
export class ReverseLedgerTransactionHandler {
  constructor(private readonly reversal: ReversalService) {}

  execute(
    command: ReverseLedgerTransactionCommand,
  ): Promise<LedgerTransaction> {
    return this.reversal.reverse(command.dto);
  }
}
