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
import { FxProvider } from '../enums/fx-provider.enum';
import { FxTradeStatus } from '../enums/fx-trade-status.enum';
import { FxRateLock } from './fx-rate-lock.entity';

/**
 * Materialized FX conversion tied to exactly one FxRateLock (unique
 * rate_lock_id). FX-owned row; ledger settlement is applied in the same DB
 * transaction as lock consumption when using international transfer flow.
 */
@Entity({ name: 'fx_trades' })
@Unique('UQ_fx_trades_rate_lock_id', ['rateLockId'])
@Index(['userId'])
@Index(['rateLockId'])
@Index(['status'])
export class FxTrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'rate_lock_id', type: 'uuid' })
  rateLockId: string;

  @ManyToOne(() => FxRateLock, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rate_lock_id' })
  rateLock: FxRateLock;

  @Column({ name: 'source_amount', type: 'decimal', precision: 19, scale: 4 })
  sourceAmount: string;

  @Column({
    name: 'source_currency',
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  sourceCurrency: Currency;

  @Column({ name: 'target_amount', type: 'decimal', precision: 19, scale: 4 })
  targetAmount: string;

  @Column({
    name: 'target_currency',
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  targetCurrency: Currency;

  @Column({ name: 'executed_rate', type: 'decimal', precision: 19, scale: 8 })
  executedRate: string;

  @Column({
    type: 'enum',
    enum: FxProvider,
    enumName: 'fx_trades_provider_enum',
  })
  provider: FxProvider;

  @Column({
    name: 'provider_reference',
    type: 'varchar',
    length: 256,
    nullable: true,
  })
  providerReference: string | null;

  @Column({
    type: 'enum',
    enum: FxTradeStatus,
    enumName: 'fx_trades_status_enum',
  })
  status: FxTradeStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
