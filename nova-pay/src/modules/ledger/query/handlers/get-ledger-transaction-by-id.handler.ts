import { Injectable } from '@nestjs/common';
import { LedgerTransaction } from '../../entities/ledger-transaction.entity';
import { LedgerService } from '../../service/ledger.service';
import { GetLedgerTransactionByIdQuery } from '../impl/get-ledger-transaction-by-id.query';

@Injectable()
export class GetLedgerTransactionByIdHandler {
  constructor(private readonly ledger: LedgerService) {}

  execute(
    query: GetLedgerTransactionByIdQuery,
  ): Promise<LedgerTransaction | null> {
    return this.ledger.getTransactionWithEntries(query.id);
  }
}
