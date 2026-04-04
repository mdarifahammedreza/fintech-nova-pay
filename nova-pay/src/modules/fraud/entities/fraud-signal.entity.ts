import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { FraudRuleResult } from '../enums/fraud-rule-result.enum';
import { FraudRuleType } from '../enums/fraud-rule-type.enum';
import { RiskDecision } from './risk-decision.entity';

/**
 * Per-rule evaluation log: result, recommended stance, structured evidence.
 * Linked to RiskDecision after aggregation when that row exists.
 */
@Entity({ name: 'fraud_signals' })
@Index(['userId'])
@Index(['correlationId'])
@Index(['paymentReference'])
@Index(['ruleType'])
@Index(['createdAt'])
export class FraudSignal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'risk_decision_id', type: 'uuid', nullable: true })
  riskDecisionId: string | null;

  @ManyToOne(() => RiskDecision, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'risk_decision_id' })
  riskDecision: RiskDecision | null;

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

  @Column({ name: 'payment_reference', type: 'varchar', length: 128 })
  paymentReference: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128 })
  correlationId: string;

  @Column({
    name: 'rule_type',
    type: 'enum',
    enum: FraudRuleType,
    enumName: 'fraud_signals_rule_type_enum',
  })
  ruleType: FraudRuleType;

  @Column({
    name: 'rule_result',
    type: 'enum',
    enum: FraudRuleResult,
    enumName: 'fraud_signals_rule_result_enum',
  })
  ruleResult: FraudRuleResult;

  @Column({
    name: 'recommended_decision',
    type: 'enum',
    enum: FraudDecisionState,
    enumName: 'fraud_risk_decisions_state_enum',
  })
  recommendedDecision: FraudDecisionState;

  @Column({ name: 'reason_code', type: 'varchar', length: 64 })
  reasonCode: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb' })
  evidence: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
