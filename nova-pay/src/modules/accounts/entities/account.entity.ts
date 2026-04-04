import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountStatus } from '../enums/account-status.enum';
import { Currency } from '../enums/currency.enum';

/**
 * Account aggregate root row. `userId` matches `users.id`; no ORM relation to
 * the users module — ownership stays in this bounded context.
 *
 * `balance` and `availableBalance` are **projections** maintained with ledger
 * postings (same transaction as ledger writes); they are not standalone
 * financial truth.
 */
@Entity({ name: 'accounts' })
@Index(['userId'])
@Index(['accountNumber'], { unique: true })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'account_number', type: 'varchar', length: 32 })
  accountNumber: string;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  /**
   * Ledger-derived total balance snapshot (same currency as `currency`).
   */
  @Column({ type: 'decimal', precision: 19, scale: 4, default: '0' })
  balance: string;

  /**
   * Spendable projection after holds, pending debits, and overdraft rules.
   */
  @Column({
    name: 'available_balance',
    type: 'decimal',
    precision: 19,
    scale: 4,
    default: '0',
  })
  availableBalance: string;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    enumName: 'accounts_status_enum',
  })
  status: AccountStatus;

  /**
   * Maximum negative `availableBalance` allowed when policy permits overdraft.
   */
  @Column({
    name: 'overdraft_limit',
    type: 'decimal',
    precision: 19,
    scale: 4,
    default: '0',
  })
  overdraftLimit: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
