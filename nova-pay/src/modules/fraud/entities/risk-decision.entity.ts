import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';

/**
 * Final synchronous fraud outcome for one evaluation. Ledger does not own this;
 * payments consume it as input only.
 */
@Entity({ name: 'fraud_risk_decisions' })
@Index(['userId'])
@Index(['correlationId'])
@Index(['paymentReference'])
@Index(['createdAt'])
export class RiskDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: FraudDecisionState,
    enumName: 'fraud_risk_decisions_state_enum',
    name: 'final_decision',
  })
  finalDecision: FraudDecisionState;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'source_account_id', type: 'uuid' })
  sourceAccountId: string;

  @Column({ name: 'destination_account_id', type: 'uuid' })
  destinationAccountId: string;

  @Column({ name: 'recipient_account_id', type: 'uuid' })
  recipientAccountId: string;

  @Column({ name: 'sender_account_id', type: 'uuid' })
  senderAccountId: string;

  @Column({ type: 'decimal', precision: 19, scale: 4 })
  amount: string;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'accounts_currency_enum',
  })
  currency: Currency;

  @Column({ name: 'payment_reference', type: 'varchar', length: 128 })
  paymentReference: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128 })
  correlationId: string;

  @Column({ type: 'jsonb' })
  finalReasons: string[];

  @Column({ name: 'triggered_rule_types', type: 'jsonb' })
  triggeredRuleTypes: string[];

  @Column({ name: 'engine_metadata', type: 'jsonb', nullable: true })
  engineMetadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
