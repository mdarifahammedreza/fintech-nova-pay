import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OutboxStatus } from './outbox-status.enum';

/**
 * Append-only outbox row written in the **same** PostgreSQL transaction as
 * domain writes (payments, ledger, …). A separate relay process publishes to
 * RabbitMQ only after commit — never treat this table as the ledger.
 */
@Entity({ name: 'outbox_events' })
@Index(['status', 'createdAt'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'routing_key', type: 'varchar', length: 256 })
  routingKey: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: OutboxStatus,
    enumName: 'outbox_events_status_enum',
    default: OutboxStatus.PENDING,
  })
  status: OutboxStatus;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  correlationId: string | null;

  /** Business-time / event payload time (ISO commit semantics). */
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /**
   * Set when a relay worker claims the row (`CLAIMED`); used to reclaim stale
   * claims after crashes (see {@link OutboxRepository.reclaimStaleClaimed}).
   */
  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
