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

  saveEntryLines(
    entities: DeepPartial<LedgerEntry>[],
  ): Promise<LedgerEntry[]> {
    return this.saveMany(entities);
  }
}
