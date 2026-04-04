import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

/**
 * Immutable financial event header. Entries hang off this row. Corrections
 * are new transactions (e.g. {@link LedgerTransactionType.REVERSAL}), not
 * updates to historical data.
 *
 * Partial unique index `uq_ledger_reversal_per_original`: at most one row with
 * `type = REVERSAL` per `reverses_transaction_id` (PostgreSQL).
 */
@Entity({ name: 'ledger_transactions' })
@Unique('ledger_transactions_correlation_id', ['correlationId'])
@Index(['status'])
@Index(['type'])
@Index('uq_ledger_reversal_per_original', ['reversesTransactionId'], {
  unique: true,
  where:
    `"type" = 'REVERSAL' AND "reverses_transaction_id" IS NOT NULL`,
})
export class LedgerTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LedgerTransactionType,
    enumName: 'ledger_transactions_type_enum',
  })
  type: LedgerTransactionType;

  @Column({
    type: 'enum',
    enum: LedgerTransactionStatus,
    enumName: 'ledger_transactions_status_enum',
  })
  status: LedgerTransactionStatus;

  /**
   * Optional link when this transaction reverses or adjusts another posted
   * transaction (by id); the referenced row itself is never mutated.
   */
  @Column({
    name: 'reverses_transaction_id',
    type: 'uuid',
    nullable: true,
  })
  reversesTransactionId: string | null;

  /**
   * Required idempotency key per posting attempt (caller-stable across retries).
   * Globally unique; DB enforces `UNIQUE` for concurrency-safe replay.
   */
  @Column({ name: 'correlation_id', type: 'varchar', length: 128 })
  correlationId: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => LedgerEntry, (e) => e.transaction)
  entries: LedgerEntry[];
}
