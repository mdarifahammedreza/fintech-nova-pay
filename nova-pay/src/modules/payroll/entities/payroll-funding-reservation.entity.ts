import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { PayrollBatch } from './payroll-batch.entity';

/**
 * Links a batch to its employer funding post (ledger id when materialized).
 * One row per batch for a simple reserve-then-fanout model.
 */
@Entity({ name: 'payroll_funding_reservations' })
export class PayrollFundingReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => PayrollBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch: PayrollBatch;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  reservedAmount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  /** ledger_transactions.id when posted; UUID only. */
  @Column({ name: 'ledger_transaction_id', type: 'uuid', nullable: true })
  ledgerTransactionId: string | null;

  /**
   * PENDING: not posted; POSTED: ledger row exists; RELEASED: unwound per rules.
   */
  @Column({ type: 'varchar', length: 32 })
  reservationStatus: 'PENDING' | 'POSTED' | 'RELEASED';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
