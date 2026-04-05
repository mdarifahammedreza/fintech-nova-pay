import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountStatusDto } from '../dto/update-account-status.dto';
import { Account } from '../entities/account.entity';
import { AccountCreatedEvent } from '../events/account-created.event';
import { AccountFrozenEvent } from '../events/account-frozen.event';
import { AccountUnfrozenEvent } from '../events/account-unfrozen.event';
import { AccountStatus } from '../enums/account-status.enum';
import { Currency } from '../enums/currency.enum';
import { AccountRepository } from '../repositories/account.repository';

const PROJECTION_SCALE = 10_000n;

/**
 * One ledger line’s effect on an account projection (4dp scaled cents).
 * CREDIT-positive / DEBIT-negative matches customer-asset wallet semantics.
 */
export type LedgerPostedProjectionLine = {
  accountId: string;
  currency: Currency;
  scaledSignedDelta: bigint;
};

/**
 * Account lifecycle and read API for this bounded context. Uses
 * {@link AccountRepository} only. Ledger/payments consume the retrieval and
 * lock helpers; they must not use this repository directly.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly outbox: OutboxRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createAccount(dto: CreateAccountDto): Promise<Account> {
    return this.dataSource.transaction(async (manager) => {
      const taken = await manager.exists(Account, {
        where: { accountNumber: dto.accountNumber },
      });
      if (taken) {
        throw new ConflictException('Account number already in use');
      }
      const status = dto.status ?? AccountStatus.PENDING;
      const row = manager.create(Account, {
        userId: dto.userId,
        accountNumber: dto.accountNumber,
        currency: dto.currency,
        status,
        balance: '0',
        availableBalance: '0',
        overdraftLimit: dto.overdraftLimit ?? '0',
      });
      const saved = await manager.save(Account, row);
      const occurredAt = new Date();
      const evt = new AccountCreatedEvent(
        saved.id,
        saved.userId,
        saved.accountNumber,
        saved.currency,
        saved.status,
        occurredAt.toISOString(),
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.ACCOUNT_CREATED,
        correlationId: null,
        occurredAt,
        payload: evt.toJSON(),
      });
      return saved;
    });
  }

  getAccountById(id: string): Promise<Account | null> {
    return this.accounts.findOneBy({ id });
  }

  /**
   * HTTP read: same as {@link getAccountById} but only when `userId` matches
   * `ownerUserId`. Missing row → `null`; wrong owner → 403 (no admin bypass).
   */
  async getAccountByIdForOwner(
    id: string,
    ownerUserId: string,
  ): Promise<Account | null> {
    const account = await this.getAccountById(id);
    if (!account) {
      return null;
    }
    if (account.userId !== ownerUserId) {
      throw new ForbiddenException('Account not accessible');
    }
    return account;
  }

  /**
   * HTTP list: returns accounts for `requestedUserId` only if it equals the
   * authenticated user (`callerUserId`).
   */
  async getUserAccountsForCaller(
    requestedUserId: string,
    callerUserId: string,
  ): Promise<Account[]> {
    if (requestedUserId !== callerUserId) {
      throw new ForbiddenException('Cannot list accounts for another user');
    }
    return this.getUserAccounts(callerUserId);
  }

  async requireAccountById(id: string): Promise<Account> {
    const account = await this.getAccountById(id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  /** All accounts for a user (any status). */
  getUserAccounts(userId: string): Promise<Account[]> {
    return this.accounts.findBy({ userId });
  }

  async updateAccountStatus(
    id: string,
    dto: UpdateAccountStatusDto,
  ): Promise<Account> {
    return this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(Account, { where: { id } });
      if (!account) {
        throw new NotFoundException('Account not found');
      }
      const previous = account.status;
      account.status = dto.status;
      const saved = await manager.save(Account, account);
      const occurredAt = new Date();
      const iso = occurredAt.toISOString();

      if (
        dto.status === AccountStatus.FROZEN &&
        previous !== AccountStatus.FROZEN
      ) {
        const evt = new AccountFrozenEvent(
          saved.id,
          saved.userId,
          saved.accountNumber,
          iso,
        );
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.ACCOUNT_FROZEN,
          correlationId: null,
          occurredAt,
          payload: evt.toJSON(),
        });
      } else if (
        previous === AccountStatus.FROZEN &&
        dto.status === AccountStatus.ACTIVE
      ) {
        const evt = new AccountUnfrozenEvent(
          saved.id,
          saved.userId,
          saved.accountNumber,
          iso,
        );
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.ACCOUNT_UNFROZEN,
          correlationId: null,
          occurredAt,
          payload: evt.toJSON(),
        });
      }

      return saved;
    });
  }

  /**
   * Public read for ledger/payments — returns null if missing.
   */
  getAccountByAccountNumber(
    accountNumber: string,
  ): Promise<Account | null> {
    return this.accounts.findByAccountNumber(accountNumber);
  }

  /**
   * Same as {@link getAccountByAccountNumber} but throws when not found.
   */
  async requireAccountByAccountNumber(
    accountNumber: string,
  ): Promise<Account> {
    const account = await this.accounts.findByAccountNumber(accountNumber);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  /**
   * Row lock (`FOR UPDATE`) for transactional projection updates. Caller
   * (e.g. ledger posting) must invoke inside an active transaction.
   */
  lockAccountForUpdate(id: string): Promise<Account | null> {
    return this.accounts.lockByIdForUpdate(id);
  }

  /**
   * Applies ledger-posting deltas to `balance` and `availableBalance` under
   * `FOR UPDATE` locks (accounts sorted by id for stable lock order).
   * Must run in the **same** `EntityManager` transaction as ledger inserts.
   */
  async applyLedgerPostingProjections(
    manager: EntityManager,
    lines: ReadonlyArray<LedgerPostedProjectionLine>,
  ): Promise<void> {
    const deltaByAccount = new Map<string, bigint>();
    const currencyByAccount = new Map<string, Currency>();

    for (const line of lines) {
      const prev = deltaByAccount.get(line.accountId) ?? 0n;
      deltaByAccount.set(line.accountId, prev + line.scaledSignedDelta);
      const existingCur = currencyByAccount.get(line.accountId);
      if (existingCur !== undefined && existingCur !== line.currency) {
        throw new BadRequestException(
          'Mixed currencies on the same account in one posting',
        );
      }
      currencyByAccount.set(line.accountId, line.currency);
    }

    const sortedIds = [...deltaByAccount.keys()].sort();
    const updated: Account[] = [];

    for (const id of sortedIds) {
      const account = await manager.findOne(Account, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new NotFoundException(
          `Account ${id} not found for ledger projection`,
        );
      }
      const expectedCurrency = currencyByAccount.get(id)!;
      if (account.currency !== expectedCurrency) {
        throw new BadRequestException(
          'Ledger line currency does not match account currency',
        );
      }

      const delta = deltaByAccount.get(id)!;
      const newBalance = parseScaledDecimal(account.balance) + delta;
      const newAvailable = parseScaledDecimal(account.availableBalance) + delta;
      const overdraftCap = parseScaledDecimal(account.overdraftLimit);

      if (newAvailable < -overdraftCap) {
        throw new BadRequestException(
          'Insufficient available balance for this ledger posting',
        );
      }

      account.balance = formatScaledDecimal(newBalance);
      account.availableBalance = formatScaledDecimal(newAvailable);
      updated.push(account);
    }

    await manager.save(Account, updated);
  }
}

function parseScaledDecimal(s: string): bigint {
  const t = s.trim();
  const m = /^(-?)(\d+)(?:\.(\d{0,4}))?$/.exec(t);
  if (!m) {
    throw new BadRequestException(`Invalid decimal amount: ${s}`);
  }
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2];
  const fracRaw = m[3] ?? '';
  const frac = (fracRaw + '0000').slice(0, 4);
  const mag = BigInt(intPart) * PROJECTION_SCALE + BigInt(frac);
  return sign * mag;
}

function formatScaledDecimal(value: bigint): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const intPart = v / PROJECTION_SCALE;
  const frac = v % PROJECTION_SCALE;
  const fracStr = frac.toString().padStart(4, '0').replace(/0+$/, '');
  const base = fracStr.length > 0 ? `${intPart}.${fracStr}` : `${intPart}`;
  return neg ? `-${base}` : base;
}
