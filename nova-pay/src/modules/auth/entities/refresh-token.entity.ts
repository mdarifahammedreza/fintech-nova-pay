import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Persists **hashed** refresh tokens only (never store raw tokens).
 * `userId` matches `users.id`; no ORM relation to the users module here.
 */
@Entity({ name: 'auth_refresh_tokens' })
@Index(['userId'])
@Index(['tokenHash'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * Hash of the opaque refresh token (e.g. SHA-256 hex of server-side secret
   * material). Size allows future algorithms.
   */
  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
