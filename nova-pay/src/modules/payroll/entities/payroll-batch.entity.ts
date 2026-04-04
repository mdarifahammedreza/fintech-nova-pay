import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItem } from './payroll-item.entity';

/**
 * Employer payroll batch: total to fund, currency, tracing fields.
 * employerAccountId references accounts.id as UUID only (no Account relation).
 */
@Entity({ name: 'payroll_batches' })
@Index(['employerAccountId'])
@Index(['status'])
@Index(['correlationId'])
@Index(['reference'])
@Index(['employerAccountId', 'idempotencyKey'], { unique: true })
export class PayrollBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employer_account_id', type: 'uuid' })
  employerAccountId: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  totalAmount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: PayrollBatchStatus,
    enumName: 'payroll_batches_status_enum',
    default: PayrollBatchStatus.DRAFT,
  })
  status: PayrollBatchStatus;

  @Column({ type: 'varchar', length: 128 })
  reference: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  correlationId: string | null;

  @Column({
    name: 'external_batch_ref',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  externalBatchRef: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PayrollItem, (item) => item.batch)
  items: PayrollItem[];
}
