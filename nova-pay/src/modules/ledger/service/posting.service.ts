import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
} from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { Account } from '../../accounts/entities/account.entity';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { AccountsService } from '../../accounts/service/accounts.service';
import {
  PostLedgerEntryLineDto,
  PostLedgerTransactionDto,
} from '../dto/post-ledger-transaction.dto';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

const SCALE_FACTOR = 10_000n;

/**
 * Financial posting: one {@link LedgerTransaction} and N {@link LedgerEntry}
 * rows per call. Does not mutate historical rows.
 *
 * **Transaction:** `post()` wraps work in its own PostgreSQL transaction.
 * {@link postWithSharedManager} uses the caller’s `EntityManager` so callers
 * (e.g. payment orchestration) can commit ledger + their writes together.
 *
 * Inside each posting segment, in order:
 * 1. `correlationId`: `FOR UPDATE` lookup; on header insert `23505`, reload winner
 *    by `correlationId` or (for `REVERSAL`) by `reversesTransactionId` and return.
 * 2. Reversal: lock target row `FOR UPDATE`, reject if already reversed or invalid;
 *    concurrent duplicate reversal inserts also hit `23505` when the partial
 *    unique index on {@link LedgerTransaction} exists in PostgreSQL (sync/migrate).
 *    Then lock accounts (sorted ids), check `ACTIVE`, currency, balance rules.
 * 3. Ledger header + entry inserts.
 * 4. Apply `balance` / `availableBalance` deltas via
 *    {@link AccountsService.applyLedgerPostingProjections} on the **same**
 *    `EntityManager` (same commit as the lines — not a separate durability story).
 * 5. Insert an outbox row only (no RabbitMQ here); relay publishes **after** commit
 *    and may retry — delivery to brokers/consumers is **not** guaranteed here.
 */
@Injectable()
export class PostingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accounts: AccountsService,
    private readonly outbox: OutboxRepository,
  ) {}

  /**
   * Validates, persists a new posted bundle, returns header with entries.
   * `correlationId` is required and unique; retries return the same row.
   * Opens and commits its own transaction (HTTP / reversal callers).
   */
  async post(dto: PostLedgerTransactionDto): Promise<LedgerTransaction> {
    const correlationId = dto.correlationId.trim();
    if (!correlationId) {
      throw new BadRequestException('correlationId is required');
    }
    return this.dataSource.transaction((manager: EntityManager) =>
      this.postWithSharedManager(manager, dto, correlationId),
    );
  }

  /**
   * Same posting logic as {@link post} on the supplied `EntityManager` (no inner
   * `DataSource.transaction`). Payment orchestration passes the open money TX so
   * payment + idempotency + ledger + projections + outbox rows commit together;
   * other callers must manage their own transaction boundary if needed.
   */
  async postWithSharedManager(
    manager: EntityManager,
    dto: PostLedgerTransactionDto,
    correlationId = dto.correlationId.trim(),
  ): Promise<LedgerTransaction> {
    if (!correlationId) {
      throw new BadRequestException('correlationId is required');
    }

    const existingLocked = await manager.findOne(LedgerTransaction, {
      where: { correlationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (existingLocked) {
      const full = await loadTxWithEntries(manager, existingLocked.id);
      return full ?? existingLocked;
    }

    this.assertReversalMetadata(dto);
    await this.assertReversalTargetPosted(manager, dto);
    assertBalancedPerCurrency(dto.entries);
    const lineNumbers = assignLineNumbers(dto.entries);

    await this.validateAccountBalancesBeforeLedgerInsert(manager, dto.entries);

    let tx: LedgerTransaction;
    try {
      tx = await manager.save(
        manager.create(LedgerTransaction, {
          type: dto.type,
          status: LedgerTransactionStatus.POSTED,
          reversesTransactionId: dto.reversesTransactionId ?? null,
          correlationId,
          memo: dto.memo ?? null,
        }),
      );
    } catch (err: unknown) {
      if (!isPostgresUniqueViolation(err)) {
        throw err;
      }
      const winner = await manager.findOne(LedgerTransaction, {
        where: { correlationId },
      });
      if (winner) {
        const replay = await loadTxWithEntries(manager, winner.id);
        return replay ?? winner;
      }
      if (
        dto.type === LedgerTransactionType.REVERSAL &&
        dto.reversesTransactionId
      ) {
        const existingReversal = await manager.findOne(LedgerTransaction, {
          where: {
            type: LedgerTransactionType.REVERSAL,
            reversesTransactionId: dto.reversesTransactionId,
          },
        });
        if (existingReversal) {
          const replay = await loadTxWithEntries(
            manager,
            existingReversal.id,
          );
          return replay ?? existingReversal;
        }
      }
      throw err;
    }

    const lineRows = dto.entries.map((e, i) => ({
      ledgerTransactionId: tx.id,
      accountId: e.accountId,
      entryType: e.entryType,
      amount: e.amount,
      currency: e.currency,
      lineNumber: lineNumbers[i]!,
      memo: e.memo ?? null,
    }));

    await manager.save(LedgerEntry, lineRows);

    const projectionLines = dto.entries.map((e) => ({
      accountId: e.accountId,
      currency: e.currency,
      scaledSignedDelta:
        e.entryType === LedgerEntryType.CREDIT
          ? parseScaledAmount(e.amount)
          : -parseScaledAmount(e.amount),
    }));

    await this.accounts.applyLedgerPostingProjections(
      manager,
      projectionLines,
    );

    const ledgerRoutingKey =
      dto.type === LedgerTransactionType.REVERSAL
        ? OutboxRoutingKey.LEDGER_TRANSACTION_REVERSED
        : OutboxRoutingKey.LEDGER_TRANSACTION_POSTED;
    await this.outbox.enqueueInTransaction(manager, {
      routingKey: ledgerRoutingKey,
      correlationId,
      occurredAt: new Date(),
      payload: {
        ledgerTransactionId: tx.id,
        correlationId,
        type: dto.type,
        reversesTransactionId: dto.reversesTransactionId ?? null,
      },
    });

    const result = await loadTxWithEntries(manager, tx.id);
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

  /**
   * Locks every account touched by the bundle (sorted id order), then checks
   * `ACTIVE`, line currency vs account currency, and
   * `availableBalance + netDelta >= -overdraftLimit` — same TX as inserts.
   */
  private async validateAccountBalancesBeforeLedgerInsert(
    manager: EntityManager,
    entries: PostLedgerEntryLineDto[],
  ): Promise<void> {
    const deltaByAccount = new Map<string, bigint>();
    const currencyByAccount = new Map<string, PostLedgerEntryLineDto['currency']>();

    for (const e of entries) {
      const mag = parseScaledAmount(e.amount);
      const signed =
        e.entryType === LedgerEntryType.CREDIT ? mag : -mag;
      deltaByAccount.set(
        e.accountId,
        (deltaByAccount.get(e.accountId) ?? 0n) + signed,
      );
      const prevCur = currencyByAccount.get(e.accountId);
      if (prevCur !== undefined && prevCur !== e.currency) {
        throw new BadRequestException(
          'Mixed currencies on the same account in one posting',
        );
      }
      currencyByAccount.set(e.accountId, e.currency);
    }

    const sortedIds = [...deltaByAccount.keys()].sort();

    for (const id of sortedIds) {
      const account = await manager.findOne(Account, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new NotFoundException(
          `Account ${id} not found for ledger posting`,
        );
      }
      if (account.status !== AccountStatus.ACTIVE) {
        throw new BadRequestException(
          'Only ACTIVE accounts may be posted against',
        );
      }
      const expectedCurrency = currencyByAccount.get(id)!;
      if (account.currency !== expectedCurrency) {
        throw new BadRequestException(
          'Ledger line currency does not match account currency',
        );
      }

      const netDelta = deltaByAccount.get(id)!;
      const availableScaled = parseScaledBalanceField(account.availableBalance);
      const overdraftScaled = parseScaledBalanceField(account.overdraftLimit);

      if (availableScaled + netDelta < -overdraftScaled) {
        throw new BadRequestException(
          'Insufficient available balance for this ledger posting',
        );
      }
    }
  }

  /**
   * Reversal path: lock the original row `FOR UPDATE`, validate `POSTED` / not
   * already a `REVERSAL`, and reject if a `REVERSAL` row for that id exists.
   * Duplicate concurrent inserts rely on the DB partial unique index (see entity)
   * plus `23505` handling in {@link postWithSharedManager}.
   */
  private async assertReversalTargetPosted(
    manager: EntityManager,
    dto: PostLedgerTransactionDto,
  ): Promise<void> {
    if (dto.type !== LedgerTransactionType.REVERSAL || !dto.reversesTransactionId) {
      return;
    }
    const target = await manager.findOne(LedgerTransaction, {
      where: { id: dto.reversesTransactionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!target) {
      throw new NotFoundException('Reversal target transaction not found');
    }
    if (target.status !== LedgerTransactionStatus.POSTED) {
      throw new BadRequestException(
        'Reversal target must be in POSTED status',
      );
    }
    if (target.type === LedgerTransactionType.REVERSAL) {
      throw new BadRequestException(
        'Reversing a reversal is not supported here; use an explicit posting',
      );
    }
    const existingReversal = await manager.findOne(LedgerTransaction, {
      where: {
        type: LedgerTransactionType.REVERSAL,
        reversesTransactionId: target.id,
      },
    });
    if (existingReversal) {
      throw new BadRequestException(
        'This ledger transaction has already been reversed',
      );
    }
  }
}

function loadTxWithEntries(
  manager: EntityManager,
  id: string,
): Promise<LedgerTransaction | null> {
  return manager
    .createQueryBuilder(LedgerTransaction, 'tx')
    .leftJoinAndSelect('tx.entries', 'e')
    .where('tx.id = :id', { id })
    .orderBy('e.lineNumber', 'ASC')
    .getOne();
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

/** Ledger entry amounts are positive; account columns may be negative. */
function parseScaledBalanceField(s: string): bigint {
  const t = s.trim();
  const m = /^(-?)(\d+)(?:\.(\d{0,4}))?$/.exec(t);
  if (!m) {
    throw new BadRequestException(`Invalid decimal: ${s}`);
  }
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2];
  const fracRaw = m[3] ?? '';
  const frac = (fracRaw + '0000').slice(0, 4);
  const mag = BigInt(intPart) * SCALE_FACTOR + BigInt(frac);
  return sign * mag;
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

function isPostgresUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) {
    return false;
  }
  const driver = (err as QueryFailedError & { driverError?: { code?: string } })
    .driverError;
  return driver?.code === '23505';
}
