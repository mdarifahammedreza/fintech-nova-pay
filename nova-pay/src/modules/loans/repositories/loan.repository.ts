import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { Loan } from '../entities/loan.entity';
import { LoanStatus } from '../enums/loan-status.enum';

/** `loans` persistence — FOR UPDATE helpers for orchestration transactions. */
@Injectable()
export class LoanRepository extends BaseRepository<Loan> {
  constructor(
    @InjectRepository(Loan)
    repository: Repository<Loan>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<Loan | null> {
    return this.findOneBy({ id });
  }

  findByApplyIdempotencyKey(
    key: string,
    scopeKey: string,
  ): Promise<Loan | null> {
    const scope = scopeKey ?? '';
    return this.findOneBy({
      applyIdempotencyKey: key,
      applyIdempotencyScopeKey: scope,
    });
  }

  findByBorrowerUserId(userId: string): Promise<Loan[]> {
    return this.findBy({ borrowerUserId: userId });
  }

  /**
   * Candidates for overdue transition: still `ACTIVE`, maturity in the past.
   * Caller applies business rules and locking.
   */
  findActiveWithMaturityBefore(cutoff: Date): Promise<Loan[]> {
    return this.repo.find({
      where: {
        status: LoanStatus.ACTIVE,
        maturityDate: LessThan(cutoff),
      },
    });
  }

  findByIdForUpdate(
    manager: EntityManager,
    id: string,
  ): Promise<Loan | null> {
    return manager.findOne(Loan, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  saveWithManager(manager: EntityManager, row: Loan): Promise<Loan> {
    return manager.getRepository(Loan).save(row);
  }
}
