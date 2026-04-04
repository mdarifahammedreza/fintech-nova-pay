import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

/**
 * Immutable financial event header. Entries hang off this row. Corrections
 * are new transactions (e.g. {@link LedgerTransactionType.REVERSAL}), not
 * updates to historical data.
 */
@Entity({ name: 'ledger_transactions' })
@Index(['status'])
@Index(['type'])
@Index(['correlationId'])
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
   * Idempotency / tracing key from the posting caller (payment, job, …).
   */
  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  correlationId: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => LedgerEntry, (e) => e.transaction)
  entries: LedgerEntry[];
}
