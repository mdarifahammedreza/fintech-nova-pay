import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { LoanRepayment } from '../entities/loan-repayment.entity';

/** `loan_repayments` persistence — no payment/ledger repositories here. */
@Injectable()
export class LoanRepaymentRepository extends BaseRepository<LoanRepayment> {
  constructor(
    @InjectRepository(LoanRepayment)
    repository: Repository<LoanRepayment>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<LoanRepayment | null> {
    return this.findOneBy({ id });
  }

  findByLoanId(loanId: string): Promise<LoanRepayment[]> {
    return this.findBy({ loanId });
  }

  saveWithManager(
    manager: EntityManager,
    row: LoanRepayment,
  ): Promise<LoanRepayment> {
    return manager.getRepository(LoanRepayment).save(row);
  }
}
