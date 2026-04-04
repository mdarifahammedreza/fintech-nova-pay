import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { FxLockStatus } from '../enums/fx-lock-status.enum';
import { FxProvider } from '../enums/fx-provider.enum';

/**
 * Time-bounded quote lock for cross-currency preparation. FX-owned; payments
 * consume via FxTrade only (one consumption per lock).
 */
@Entity({ name: 'fx_rate_locks' })
@Index(['userId'])
@Index(['status'])
@Index(['expiresAt'])
export class FxRateLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'source_currency',
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  sourceCurrency: Currency;

  @Column({
    name: 'target_currency',
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  targetCurrency: Currency;

  @Column({ name: 'source_amount', type: 'decimal', precision: 19, scale: 4 })
  sourceAmount: string;

  @Column({ name: 'locked_rate', type: 'decimal', precision: 19, scale: 8 })
  lockedRate: string;

  @Column({
    type: 'enum',
    enum: FxProvider,
    enumName: 'fx_rate_locks_provider_enum',
  })
  provider: FxProvider;

  @Column({
    name: 'provider_reference',
    type: 'varchar',
    length: 256,
    nullable: true,
  })
  providerReference: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({
    type: 'enum',
    enum: FxLockStatus,
    enumName: 'fx_rate_locks_status_enum',
  })
  status: FxLockStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
