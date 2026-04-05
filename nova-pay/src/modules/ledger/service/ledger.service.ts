import { Injectable } from '@nestjs/common';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { AccountLedgerStatementLineView } from '../interfaces/account-ledger-statement-line.view';
import { LedgerEntryRepository } from '../repositories/ledger-entry.repository';
import { LedgerTransactionRepository } from '../repositories/ledger-transaction.repository';

const STATEMENT_MAX_LIMIT = 100;

/**
 * Read-side ledger API for handlers and other modules. Writes go through
 * {@link PostingService} / {@link ReversalService}.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly txRepo: LedgerTransactionRepository,
    private readonly entryRepo: LedgerEntryRepository,
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

  /**
   * Statement lines from `ledger_entries` joined to `ledger_transactions`.
   * Caller must enforce account ownership.
   */
  async getAccountStatementPage(
    accountId: string,
    page: number,
    limit: number,
  ): Promise<{
    lines: AccountLedgerStatementLineView[];
    total: number;
    page: number;
    limit: number;
  }> {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(
      STATEMENT_MAX_LIMIT,
      Math.max(1, Math.floor(limit) || 20),
    );
    const skip = (safePage - 1) * safeLimit;
    const [entries, total] =
      await this.entryRepo.findStatementPageByAccountId(
        accountId,
        skip,
        safeLimit,
      );
    const lines: AccountLedgerStatementLineView[] = entries.map((e) => {
      const t = e.transaction;
      return {
        ledgerEntryId: e.id,
        ledgerTransactionId: e.ledgerTransactionId,
        correlationId: t.correlationId,
        transactionType: t.type,
        transactionStatus: t.status,
        reversesTransactionId: t.reversesTransactionId,
        entryType: e.entryType,
        amount: e.amount,
        currency: e.currency,
        lineNumber: e.lineNumber,
        entryMemo: e.memo,
        transactionMemo: t.memo,
        postedAt: t.createdAt,
      };
    });
    return { lines, total, page: safePage, limit: safeLimit };
  }
}
