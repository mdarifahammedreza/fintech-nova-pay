import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';

/**
 * `ledger_transactions` persistence. Persist new headers with
 * {@link BaseRepository.save}; no posting rules or balance checks here.
 */
@Injectable()
export class LedgerTransactionRepository extends BaseRepository<LedgerTransaction> {
  constructor(
    @InjectRepository(LedgerTransaction)
    repository: Repository<LedgerTransaction>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<LedgerTransaction | null> {
    return this.findOneBy({ id });
  }

  findByCorrelationId(
    correlationId: string,
  ): Promise<LedgerTransaction | null> {
    return this.findOneBy({ correlationId });
  }

  /**
   * Loads the header with entry lines ordered by `line_number` (read path).
   */
  findWithEntriesById(id: string): Promise<LedgerTransaction | null> {
    return this.repo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.entries', 'e')
      .where('tx.id = :id', { id })
      .orderBy('e.line_number', 'ASC')
      .getOne();
  }
}
