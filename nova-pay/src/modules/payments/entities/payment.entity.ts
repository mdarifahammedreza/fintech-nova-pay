import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';
import { IdempotencyRecord } from './idempotency-record.entity';

/**
 * Payment aggregate root — this module owns the table only. `sourceAccountId`
 * / `destinationAccountId` match `accounts.id`; `ledgerTransactionId` matches
 * `ledger_transactions.id` after posting — no ORM relations across modules.
 *
 * Domain notifications (`payment.*`) must be written to the **outbox** in the
 * same PostgreSQL transaction as status transitions, then published after
 * commit — not emitted directly from controllers.
 */
@Entity({ name: 'payments' })
@Index(['status'])
@Index(['type'])
@Index(['reference'])
@Index(['correlationId'])
@Index(['idempotencyRecordId'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PaymentType,
    enumName: 'payments_type_enum',
  })
  type: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payments_status_enum',
  })
  status: PaymentStatus;

  /**
   * Stable business reference (client-generated or gateway id) for support
   * and reconciliation — not the idempotency key.
   */
  @Column({ type: 'varchar', length: 128 })
  reference: string;

  @Column({ name: 'idempotency_record_id', type: 'uuid' })
  idempotencyRecordId: string;

  @ManyToOne(() => IdempotencyRecord, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'idempotency_record_id' })
  idempotencyRecord: IdempotencyRecord;

  @Column({ name: 'source_account_id', type: 'uuid' })
  sourceAccountId: string;

  @Column({ name: 'destination_account_id', type: 'uuid' })
  destinationAccountId: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  /**
   * Populated after ledger-first posting succeeds; immutable once set.
   */
  @Column({ name: 'ledger_transaction_id', type: 'uuid', nullable: true })
  ledgerTransactionId: string | null;

  /**
   * End-to-end tracing (API → outbox → consumers). Distinct from idempotency key.
   */
  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  correlationId: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
