import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

/**
 * Money-moving code must use the **default (write)** DataSource only.
 * Do not run transactions against the `read` connection.
 */
export type TransactionCallback<T> = (manager: EntityManager) => Promise<T>;

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Single DB transaction (default isolation, usually READ COMMITTED).
   * Use for ledger + balance projection + outbox in one boundary.
   */
  run<T>(work: TransactionCallback<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }

  /**
   * Transaction with explicit isolation (e.g. SERIALIZABLE for hot accounts).
   */
  runWithIsolation<T>(
    isolation: IsolationLevel,
    work: TransactionCallback<T>,
  ): Promise<T> {
    return this.dataSource.transaction(isolation, work);
  }

  /**
   * Manual `QueryRunner` lifecycle for nested or staged work.
   * Caller **must** `connect`, `startTransaction`, `commit`/`rollback`, `release`.
   */
  createQueryRunner(): QueryRunner {
    return this.dataSource.createQueryRunner();
  }

  /**
   * Wraps `work` with connect + start + commit/rollback + release.
   */
  async withQueryRunner<T>(
    work: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const qr = this.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const out = await work(qr);
      await qr.commitTransaction();
      return out;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}
