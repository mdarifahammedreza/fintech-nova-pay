import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Postgres-backed idempotency slot for mutating payment APIs (`Idempotency-Key`
 * + optional scope). The committed {@link Payment} row references this record
 * via `payments.idempotency_record_id` (unique) for replay-safe outcomes.
 *
 * TODO: Migration when `DATABASE_SYNCHRONIZE=false` — add enum value `FAILED`
 * and columns `linked_payment_id`, `business_reference` if upgrading an
 * existing database.
 */
export enum IdempotencyRecordStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  /** Terminal: payment row ended in `FAILED` for this slot (safe replay). */
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT',
}

@Entity({ name: 'payments_idempotency_records' })
@Index(['idempotencyKey', 'scopeKey'], { unique: true })
export class IdempotencyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey: string;

  /**
   * Disambiguates the same key across actors (e.g. `user:<uuid>`). Use `''`
   * when a single global namespace is enough.
   */
  @Column({ name: 'scope_key', type: 'varchar', length: 128, default: '' })
  scopeKey: string;

  @Column({
    type: 'enum',
    enum: IdempotencyRecordStatus,
    enumName: 'payments_idempotency_record_status_enum',
  })
  status: IdempotencyRecordStatus;

  /**
   * Hash of canonical request body bytes for conflict detection (same key,
   * different payload → CONFLICT).
   */
  @Column({ name: 'request_fingerprint', type: 'varchar', length: 64, nullable: true })
  requestFingerprint: string | null;

  /**
   * Denormalized link to the payment materialized for this slot (outcome row).
   * Mirrors `payments.id` where `payments.idempotency_record_id` = this `id`.
   */
  @Column({ name: 'linked_payment_id', type: 'uuid', nullable: true })
  linkedPaymentId: string | null;

  /**
   * Business reference snapshot from the first successful bind (reconciliation
   * without joining `payments` for support reads).
   */
  @Column({ name: 'business_reference', type: 'varchar', length: 128, nullable: true })
  businessReference: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
