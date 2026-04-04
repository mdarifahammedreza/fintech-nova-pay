import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Rolling histogram of transaction activity by clock hour (0–23) for unusual
 * hour detection. Fraud-owned; updated when payments report activity (via
 * fraud service hooks in later phases), not by direct ledger access.
 */
@Entity({ name: 'fraud_user_transaction_hour_profiles' })
@Unique('UQ_fraud_hour_profile_user_bucket', ['userId', 'hourBucket'])
@Index(['userId'])
export class UserTransactionHourProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** 0–23 in the timezone used for evaluation (see engine TODO for TZ). */
  @Column({ name: 'hour_bucket', type: 'smallint' })
  hourBucket: number;

  @Column({ name: 'transaction_count', type: 'int', default: 0 })
  transactionCount: number;

  @Column({ name: 'last_increment_at', type: 'timestamptz', nullable: true })
  lastIncrementAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
