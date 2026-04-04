import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { PayrollRun } from '../entities/payroll-run.entity';

/**
 * `payroll_runs` persistence — query methods added with business logic.
 */
@Injectable()
export class PayrollRunRepository extends BaseRepository<PayrollRun> {
  constructor(
    @InjectRepository(PayrollRun)
    repository: Repository<PayrollRun>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<PayrollRun | null> {
    return this.findOneBy({ id });
  }
}
