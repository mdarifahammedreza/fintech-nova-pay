import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production-safe DDL when `synchronize=false`:
 * - Ensures `outbox_events_status_enum` includes `CLAIMED` (relay worker claim).
 * - Ensures `outbox_events.claimed_at` exists for stale-claim reclaim.
 *
 * Idempotent: safe if a prior migration already applied the same changes.
 * PostgreSQL does not support dropping individual enum values in `down` without
 * recreating the type; `down` only removes `claimed_at` (use with care).
 */
export class EnsureOutboxEventsStatusEnumIncludesClaimed1742000000000
  implements MigrationInterface
{
  name = 'EnsureOutboxEventsStatusEnumIncludesClaimed1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$ BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public'
            AND t.typname = 'outbox_events_status_enum'
        ) THEN
          ALTER TYPE "outbox_events_status_enum" ADD VALUE 'CLAIMED';
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $do$;
    `);
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMPTZ NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "claimed_at";
    `);
  }
}
