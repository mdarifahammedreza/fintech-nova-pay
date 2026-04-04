import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Account } from '../entities/account.entity';
import { AccountStatus } from '../enums/account-status.enum';
import { Currency } from '../enums/currency.enum';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountStatusDto } from '../dto/update-account-status.dto';
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
  constructor(private readonly accounts: AccountRepository) {}

  async createAccount(dto: CreateAccountDto): Promise<Account> {
    if (await this.accounts.existsBy({ accountNumber: dto.accountNumber })) {
      throw new ConflictException('Account number already in use');
    }
    return this.accounts.save({
      userId: dto.userId,
      accountNumber: dto.accountNumber,
      currency: dto.currency,
      status: dto.status ?? AccountStatus.PENDING,
      balance: '0',
      availableBalance: '0',
      overdraftLimit: dto.overdraftLimit ?? '0',
    });
  }

  getAccountById(id: string): Promise<Account | null> {
    return this.accounts.findOneBy({ id });
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
    const account = await this.requireAccountById(id);
    account.status = dto.status;
    return this.accounts.save(account);
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
