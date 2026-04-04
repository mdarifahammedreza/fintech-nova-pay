import { Injectable } from '@nestjs/common';
import { LedgerTransaction } from '../../entities/ledger-transaction.entity';
import { PostingService } from '../../service/posting.service';
import { PostLedgerTransactionCommand } from '../impl/post-ledger-transaction.command';

@Injectable()
export class PostLedgerTransactionHandler {
  constructor(private readonly posting: PostingService) {}

  execute(
    command: PostLedgerTransactionCommand,
  ): Promise<LedgerTransaction> {
    return this.posting.post(command.dto);
  }
}
