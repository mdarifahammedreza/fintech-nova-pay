import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * Serializes payroll **employer-account funding debits** (employer → clearing)
 * across all app instances using the shared PostgreSQL database.
 *
 * Uses `pg_advisory_xact_lock` so the lock is held only for the duration of
 * the caller’s transaction and released on commit/rollback — no pool
 * stickiness and no weakening of ledger posting atomicity.
 *
 * @see decisions.md — payroll employer serialization (vs BullMQ)
 */
@Injectable()
export class PayrollEmployerFundingLockService {
  /**
   * Blocks until this transaction holds the employer-scoped advisory lock.
   * Call only when about to post a new funding debit for that employer.
   */
  async assertTransactionScopedEmployerLock(
    manager: EntityManager,
    employerAccountId: string,
  ): Promise<void> {
    await manager.query(
      `SELECT pg_advisory_xact_lock(
        hashtext('nova.payroll.employer_funding'),
        hashtext($1::text)
      )`,
      [employerAccountId],
    );
  }
}
