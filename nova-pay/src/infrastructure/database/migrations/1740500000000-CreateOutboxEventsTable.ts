import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline `outbox_events` when `synchronize=false`. Runs before incremental
 * outbox/ledger migrations that assume this table exists.
 */
export class CreateOutboxEventsTable1740500000000 implements MigrationInterface {
  name = 'CreateOutboxEventsTable1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "outbox_events_status_enum" AS ENUM (
          'PENDING',
          'CLAIMED',
          'PUBLISHED',
          'FAILED'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $do$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "routing_key" character varying(256) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "outbox_events_status_enum" NOT NULL DEFAULT 'PENDING',
        "correlation_id" character varying(128),
        "occurred_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "claimed_at" TIMESTAMPTZ,
        "published_at" TIMESTAMPTZ,
        CONSTRAINT "PK_outbox_events" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_outbox_events_status_created_at"
      ON "outbox_events" ("status", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_outbox_events_status_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "outbox_events_status_enum"`);
  }
}
