import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Account } from '../entities/account.entity';
import { AccountStatus } from '../enums/account-status.enum';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountStatusDto } from '../dto/update-account-status.dto';
import { AccountRepository } from '../repositories/account.repository';

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
}
