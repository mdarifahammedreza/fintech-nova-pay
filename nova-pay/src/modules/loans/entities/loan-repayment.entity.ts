import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LoanRepaymentStatus } from '../enums/loan-repayment-status.enum';

/**
 * One repayment attempt against a loan. Money path binds `paymentId` /
 * `paymentCorrelationId` after {@link PaymentOrchestratorService} completes.
 * No ORM relation to `Payment` — UUID references only (module boundary).
 */
@Entity({ name: 'loan_repayments' })
@Index(['loanId'])
@Index(['status'])
export class LoanRepayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'loan_id', type: 'uuid' })
  loanId: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: string;

  @Column({
    type: 'enum',
    enum: LoanRepaymentStatus,
    enumName: 'loans_repayment_status_enum',
    default: LoanRepaymentStatus.PENDING,
  })
  status: LoanRepaymentStatus;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({
    name: 'payment_correlation_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  paymentCorrelationId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
