import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { LoanStatus } from '../enums/loan-status.enum';

/**
 * Loan aggregate root. Wallet disbursement and repayments must go through
 * payments + ledger public APIs; this row stores UUID references and amounts
 * only (no cross-module TypeORM relations).
 */
@Entity({ name: 'loans' })
@Index(['borrowerUserId'])
@Index(['status'])
@Index(['maturityDate'])
@Index(['applyIdempotencyKey', 'applyIdempotencyScopeKey'], { unique: true })
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'borrower_user_id', type: 'uuid' })
  borrowerUserId: string;

  @Column({
    type: 'enum',
    enum: LoanStatus,
    enumName: 'loans_status_enum',
    default: LoanStatus.DRAFT,
  })
  status: LoanStatus;

  /** Original approved principal (immutable after approval). */
  @Column({ type: 'decimal', precision: 19, scale: 4, default: '0' })
  principalAmount: string;

  /** Remaining principal after disbursement schedule / repayments (ledger truth). */
  @Column({
    name: 'outstanding_principal',
    type: 'decimal',
    precision: 19,
    scale: 4,
    default: '0',
  })
  outstandingPrincipal: string;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  /** Destination wallet account for disbursement (`accounts.id`). */
  @Column({ name: 'borrower_wallet_account_id', type: 'uuid', nullable: true })
  borrowerWalletAccountId: string | null;

  /** Internal pool / asset account debited on disburse (`accounts.id`). */
  @Column({ name: 'loan_funding_account_id', type: 'uuid', nullable: true })
  loanFundingAccountId: string | null;

  @Column({ name: 'interest_rate_bps', type: 'int', nullable: true })
  interestRateBps: number | null;

  @Column({ name: 'term_months', type: 'int', nullable: true })
  termMonths: number | null;

  /** Used with `ACTIVE` status for overdue sweeps (`now() > maturityDate`). */
  @Column({ name: 'maturity_date', type: 'timestamptz', nullable: true })
  maturityDate: Date | null;

  @Column({
    name: 'apply_idempotency_key',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  applyIdempotencyKey: string | null;

  @Column({
    name: 'apply_idempotency_scope_key',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  applyIdempotencyScopeKey: string | null;

  @Column({ name: 'disbursement_payment_id', type: 'uuid', nullable: true })
  disbursementPaymentId: string | null;

  @Column({
    name: 'disbursement_correlation_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  disbursementCorrelationId: string | null;

  @Column({ name: 'last_repayment_payment_id', type: 'uuid', nullable: true })
  lastRepaymentPaymentId: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'disbursed_at', type: 'timestamptz', nullable: true })
  disbursedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'marked_overdue_at', type: 'timestamptz', nullable: true })
  markedOverdueAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
