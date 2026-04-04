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
 */
export enum IdempotencyRecordStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
