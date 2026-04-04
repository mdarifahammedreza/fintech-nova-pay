import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransaction } from './ledger-transaction.entity';

/**
 * Immutable ledger line. `accountId` matches `accounts.id`; no ORM relation to
 * the accounts module. Never UPDATE to “fix” money — post a compensating
 * transaction instead.
 */
@Entity({ name: 'ledger_entries' })
@Index(['accountId'])
@Index(['ledgerTransactionId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ledger_transaction_id', type: 'uuid' })
  ledgerTransactionId: string;

  @ManyToOne(() => LedgerTransaction, (tx) => tx.entries, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'ledger_transaction_id' })
  transaction: LedgerTransaction;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({
    name: 'entry_type',
    type: 'enum',
    enum: LedgerEntryType,
    enumName: 'ledger_entries_entry_type_enum',
  })
  entryType: LedgerEntryType;

  /**
   * Positive magnitude in `currency`; debit/credit role comes from
   * {@link entryType}.
   */
  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    /** Reuse accounts enum type so currency values stay one canonical set. */
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  @Column({ name: 'line_number', type: 'int' })
  lineNumber: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
