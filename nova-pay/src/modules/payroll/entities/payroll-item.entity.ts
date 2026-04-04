import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';
import { PayrollBatch } from './payroll-batch.entity';

/**
 * One employee payout line. employeeAccountId is accounts.id as UUID only.
 * itemReference is unique per batch for idempotent line upserts.
 */
@Entity({ name: 'payroll_items' })
@Unique(['batch', 'itemReference'])
@Index(['employeeAccountId'])
@Index(['status'])
export class PayrollItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PayrollBatch, (batch) => batch.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batch_id' })
  batch: PayrollBatch;

  @Column({ name: 'employee_account_id', type: 'uuid' })
  employeeAccountId: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: PayrollItemStatus,
    enumName: 'payroll_items_status_enum',
    default: PayrollItemStatus.PENDING,
  })
  status: PayrollItemStatus;

  @Column({ name: 'item_reference', type: 'varchar', length: 128 })
  itemReference: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'ledger_transaction_id', type: 'uuid', nullable: true })
  ledgerTransactionId: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
