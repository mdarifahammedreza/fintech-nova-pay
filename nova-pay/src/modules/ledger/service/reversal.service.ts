import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PostLedgerEntryLineDto,
  PostLedgerTransactionDto,
} from '../dto/post-ledger-transaction.dto';
import { ReverseLedgerTransactionDto } from '../dto/reverse-ledger-transaction.dto';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';
import { LedgerTransactionRepository } from '../repositories/ledger-transaction.repository';
import { PostingService } from './posting.service';

/**
 * Compensating postings: builds mirrored debit/credit lines and delegates to
 * {@link PostingService} so history is never updated in place.
 *
 * **Transaction boundary:** the reversal attempt should run in one TX with
 * `PostingService.post` (ledger persist → projections →
 * `ledger.transaction.reversed` outbox for `REVERSAL` type). Optionally lock
 * the original transaction
 * row or use isolation so double-reversal is impossible.
 *
 * TODO: Pass through the same `EntityManager` as `PostingService.post` when
 * multi-step ledger APIs are wired.
 * TODO: Reject if `originalLedgerTransactionId` was already reversed (policy).
 */
@Injectable()
export class ReversalService {
  constructor(
    private readonly txRepo: LedgerTransactionRepository,
    private readonly posting: PostingService,
  ) {}

  /**
   * Posts a new `REVERSAL` transaction that offsets each line of the original.
   */
  async reverse(dto: ReverseLedgerTransactionDto): Promise<LedgerTransaction> {
    if (dto.correlationId) {
      const existing = await this.txRepo.findByCorrelationId(dto.correlationId);
      if (existing) {
        const full = await this.txRepo.findWithEntriesById(existing.id);
        return full ?? existing;
      }
    }

    const original = await this.txRepo.findWithEntriesById(
      dto.originalLedgerTransactionId,
    );
    if (!original?.entries?.length) {
      throw new NotFoundException('Original ledger transaction not found');
    }
    if (original.status !== LedgerTransactionStatus.POSTED) {
      throw new BadRequestException('Only posted transactions can be reversed');
    }
    if (original.type === LedgerTransactionType.REVERSAL) {
      throw new BadRequestException(
        'Reversing a reversal is not supported here; use an explicit posting',
      );
    }

    const entries: PostLedgerEntryLineDto[] = original.entries.map((e) => ({
      accountId: e.accountId,
      entryType:
        e.entryType === LedgerEntryType.DEBIT
          ? LedgerEntryType.CREDIT
          : LedgerEntryType.DEBIT,
      amount: e.amount,
      currency: e.currency,
      lineNumber: e.lineNumber,
      memo: e.memo ?? undefined,
    }));

    const postDto: PostLedgerTransactionDto = {
      type: LedgerTransactionType.REVERSAL,
      reversesTransactionId: original.id,
      correlationId: dto.correlationId,
      memo: dto.memo,
      entries,
    };

    return this.posting.post(postDto);
  }
}
