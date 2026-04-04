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
 * First-seen device tracking per user. userId is a UUID reference only.
 */
@Entity({ name: 'fraud_known_devices' })
@Unique('UQ_fraud_known_devices_user_fingerprint', ['userId', 'deviceFingerprint'])
@Index(['userId'])
export class KnownDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'device_id', type: 'varchar', length: 256, nullable: true })
  deviceId: string | null;

  @Column({ name: 'device_fingerprint', type: 'varchar', length: 512 })
  deviceFingerprint: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
