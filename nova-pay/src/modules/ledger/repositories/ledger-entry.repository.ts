import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { LedgerEntry } from '../entities/ledger-entry.entity';

/**
 * `ledger_entries` persistence. Persist lines with {@link BaseRepository.save}
 * or {@link saveEntryLines}; no double-entry validation here.
 */
@Injectable()
export class LedgerEntryRepository extends BaseRepository<LedgerEntry> {
  constructor(
    @InjectRepository(LedgerEntry)
    repository: Repository<LedgerEntry>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<LedgerEntry | null> {
    return this.findOneBy({ id });
  }

  findByLedgerTransactionId(
    ledgerTransactionId: string,
  ): Promise<LedgerEntry[]> {
    return this.find({
      where: { ledgerTransactionId },
      order: { lineNumber: 'ASC' },
    });
  }

  findByAccountId(accountId: string): Promise<LedgerEntry[]> {
    return this.find({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Paginated ledger lines for an account with transaction header (statement).
   * Newest transactions first; lines within a transaction by line number.
   */
  findStatementPageByAccountId(
    accountId: string,
    skip: number,
    take: number,
  ): Promise<[LedgerEntry[], number]> {
    return this.repository
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.transaction', 't')
      .where('e.accountId = :accountId', { accountId })
      .orderBy('t.createdAt', 'DESC')
      .addOrderBy('e.lineNumber', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }

  saveEntryLines(
    entities: DeepPartial<LedgerEntry>[],
  ): Promise<LedgerEntry[]> {
    return this.saveMany(entities);
  }
}
