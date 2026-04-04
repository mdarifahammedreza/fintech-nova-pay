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
 * ## Ordering inside the **shared** money `EntityManager` transaction
 *
 * Callers (e.g. payment orchestration) start the TX, hold account locks, and run
 * balance checks **before** calling into here. This service must **not** open
 * its own committing boundary once wired — accept `EntityManager` when ready.
 *
 * 1. **Validation** — balanced entries, reversal metadata (pure or same-manager
 *    reads as required).
 * 2. **Ledger persist** — insert transaction header + entry lines atomically
 *    (no committed header without lines).
 * 3. **Balance projections** — update `accounts` for each `accountId` in entries
 *    in the **same** TX (delegation TBD; not implemented here).
 * 4. **Outbox** — `OutboxRepository.enqueueInTransaction` for
 *    `ledger.transaction.posted` (payload from committed-in-TX state only).
 *
 * TODO: Add `post(manager: EntityManager, dto)` (or equivalent) and route all
 * saves through `manager` so steps 2–4 share the caller’s TX.
 * TODO: Wire projection updates and outbox enqueue once account/ledger coupling
 * is injected without cross-module repository leaks.
 * RabbitMQ: only after DB commit via outbox relay — never `emit` here.
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
   *
   * TODO: Idempotency replay (`findByCorrelationId`) must run under the caller’s
   * TX / isolation so a concurrent poster cannot race between check and insert.
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

    // TODO: Steps 2–4 of class-level ordering — use caller `EntityManager` and
    // include projection + `ledger.transaction.posted` outbox before commit.
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
