import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayrollRunStatus } from '../enums/payroll-run-status.enum';

/**
 * Aggregate root placeholder for a payroll run — extend when implementing
 * reservation and fanout flows.
 */
@Entity({ name: 'payroll_runs' })
export class PayrollRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PayrollRunStatus,
    enumName: 'payroll_runs_status_enum',
    default: PayrollRunStatus.DRAFT,
  })
  status: PayrollRunStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
