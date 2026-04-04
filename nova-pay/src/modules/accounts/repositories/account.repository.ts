import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { Account } from '../entities/account.entity';
import { AccountStatus } from '../enums/account-status.enum';

@Injectable()
export class AccountRepository extends BaseRepository<Account> {
  constructor(
    @InjectRepository(Account)
    repository: Repository<Account>,
  ) {
    super(repository);
  }

  findByAccountNumber(accountNumber: string): Promise<Account | null> {
    return this.findOneBy({ accountNumber });
  }

  findActiveByUserId(userId: string): Promise<Account[]> {
    return this.findBy({
      userId,
      status: AccountStatus.ACTIVE,
    });
  }

  /**
   * Row lock for transactional balance / projection updates. Caller must run
   * inside an active query runner / transaction.
   */
  lockByIdForUpdate(id: string): Promise<Account | null> {
    return this.repo.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
