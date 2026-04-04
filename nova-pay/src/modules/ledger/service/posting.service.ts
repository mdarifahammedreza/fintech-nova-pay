import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PostLedgerEntryLineDto,
  PostLedgerTransactionDto,
} from '../dto/post-ledger-transaction.dto';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';
import { LedgerEntryRepository } from '../repositories/ledger-entry.repository';
import { LedgerTransactionRepository } from '../repositories/ledger-transaction.repository';

const SCALE_FACTOR = 10_000n;

/**
 * Financial posting: one {@link LedgerTransaction} and N {@link LedgerEntry}
 * rows per call. Does not mutate historical rows.
 *
 * TODO: Run validation + inserts + account projection updates + outbox writes
 * inside one explicit DB transaction (query runner / transactionalEntityManager).
 * TODO: Emit `ledger.transaction.posted` only via outbox after commit — never
 * publish RabbitMQ from this service before commit.
 */
@Injectable()
export class PostingService {
  constructor(
    private readonly txRepo: LedgerTransactionRepository,
    private readonly entryRepo: LedgerEntryRepository,
  ) {}

  /**
   * Validates, persists a new posted bundle, returns header with entries.
   * Idempotent when `correlationId` matches an existing transaction.
   */
  async post(dto: PostLedgerTransactionDto): Promise<LedgerTransaction> {
    if (dto.correlationId) {
      const existing = await this.txRepo.findByCorrelationId(dto.correlationId);
      if (existing) {
        const full = await this.txRepo.findWithEntriesById(existing.id);
        return full ?? existing;
      }
    }

    this.assertReversalMetadata(dto);
    await this.assertReversalTargetPosted(dto);
    assertBalancedPerCurrency(dto.entries);
    const lineNumbers = assignLineNumbers(dto.entries);

    // TODO: Move the following saves into the same TX as account locks/projections.
    const tx = await this.txRepo.save({
      type: dto.type,
      status: LedgerTransactionStatus.POSTED,
      reversesTransactionId: dto.reversesTransactionId ?? null,
      correlationId: dto.correlationId ?? null,
      memo: dto.memo ?? null,
    });

    const lines = dto.entries.map((e, i) => ({
      ledgerTransactionId: tx.id,
      accountId: e.accountId,
      entryType: e.entryType,
      amount: e.amount,
      currency: e.currency,
      lineNumber: lineNumbers[i]!,
      memo: e.memo ?? null,
    }));

    await this.entryRepo.saveEntryLines(lines);

    const result = await this.txRepo.findWithEntriesById(tx.id);
    if (!result) {
      throw new NotFoundException('Posted transaction not found after save');
    }
    return result;
  }

  private assertReversalMetadata(dto: PostLedgerTransactionDto): void {
    if (dto.type === LedgerTransactionType.REVERSAL) {
      if (!dto.reversesTransactionId) {
        throw new BadRequestException(
          'reversesTransactionId is required when type is REVERSAL',
        );
      }
      return;
    }
    if (dto.reversesTransactionId) {
      throw new BadRequestException(
        'reversesTransactionId is only allowed when type is REVERSAL',
      );
    }
  }

  private async assertReversalTargetPosted(
    dto: PostLedgerTransactionDto,
  ): Promise<void> {
    if (dto.type !== LedgerTransactionType.REVERSAL || !dto.reversesTransactionId) {
      return;
    }
    const target = await this.txRepo.findById(dto.reversesTransactionId);
    if (!target) {
      throw new NotFoundException('Reversal target transaction not found');
    }
    if (target.status !== LedgerTransactionStatus.POSTED) {
      throw new BadRequestException(
        'Reversal target must be in POSTED status',
      );
    }
  }
}

function parseScaledAmount(amount: string): bigint {
  const t = amount.trim();
  const m = /^(\d+)(?:\.(\d{0,4}))?$/.exec(t);
  if (!m) {
    throw new BadRequestException(`Invalid amount: ${amount}`);
  }
  const intPart = m[1];
  const fracRaw = m[2] ?? '';
  const frac = (fracRaw + '0000').slice(0, 4);
  return BigInt(intPart) * SCALE_FACTOR + BigInt(frac);
}

function assertBalancedPerCurrency(entries: PostLedgerEntryLineDto[]): void {
  const sums = new Map<string, { dr: bigint; cr: bigint }>();
  for (const e of entries) {
    const scaled = parseScaledAmount(e.amount);
    const key = e.currency;
    let agg = sums.get(key);
    if (!agg) {
      agg = { dr: 0n, cr: 0n };
      sums.set(key, agg);
    }
    if (e.entryType === LedgerEntryType.DEBIT) {
      agg.dr += scaled;
    } else {
      agg.cr += scaled;
    }
  }
  for (const [, v] of sums) {
    if (v.dr !== v.cr) {
      throw new BadRequestException(
        'Ledger entries are not balanced (debits must equal credits per currency)',
      );
    }
  }
}

function assignLineNumbers(entries: PostLedgerEntryLineDto[]): number[] {
  const explicit = entries.every((e) => e.lineNumber !== undefined);
  const implicit = entries.every((e) => e.lineNumber === undefined);
  if (explicit) {
    const nums = entries.map((e) => e.lineNumber!);
    const uniq = new Set(nums);
    if (uniq.size !== nums.length) {
      throw new BadRequestException('Duplicate lineNumber values');
    }
    return nums;
  }
  if (implicit) {
    return entries.map((_, i) => i + 1);
  }
  throw new BadRequestException(
    'lineNumber must be provided for all lines or omitted for all',
  );
}
