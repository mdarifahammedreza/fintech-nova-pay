import { Injectable } from '@nestjs/common';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { LedgerTransactionRepository } from '../repositories/ledger-transaction.repository';

/**
 * Read-side ledger API for handlers and other modules. Writes go through
 * {@link PostingService} / {@link ReversalService}.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly txRepo: LedgerTransactionRepository,
  ) {}

  getTransactionById(id: string): Promise<LedgerTransaction | null> {
    return this.txRepo.findById(id);
  }

  getTransactionWithEntries(
    id: string,
  ): Promise<LedgerTransaction | null> {
    return this.txRepo.findWithEntriesById(id);
  }

  findTransactionByCorrelationId(
    correlationId: string,
  ): Promise<LedgerTransaction | null> {
    return this.txRepo.findByCorrelationId(correlationId);
  }
}
