import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production DDL when `synchronize=false`:
 * - `CLAIMED` outbox status + `claimed_at` for relay reclaim
 * - partial unique index: one `REVERSAL` per `reverses_transaction_id`
 */
export class OutboxClaimedAndLedgerReversalUnique1741200000000
  implements MigrationInterface
{
  name = 'OutboxClaimedAndLedgerReversalUnique1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$ BEGIN
        ALTER TYPE "outbox_events_status_enum" ADD VALUE 'CLAIMED';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $do$;
    `);
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMPTZ NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ledger_reversal_per_original"
      ON "ledger_transactions" ("reverses_transaction_id")
      WHERE type = 'REVERSAL' AND reverses_transaction_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_ledger_reversal_per_original"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "claimed_at"`,
    );
  }
}
