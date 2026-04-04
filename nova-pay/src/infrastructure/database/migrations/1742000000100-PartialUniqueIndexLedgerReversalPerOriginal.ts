import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * At most one `REVERSAL` ledger row per `reverses_transaction_id` (matches
 * {@link LedgerTransaction} partial unique index `uq_ledger_reversal_per_original`).
 *
 * Idempotent: `IF NOT EXISTS` keeps staging/prod reapplies safe.
 */
export class PartialUniqueIndexLedgerReversalPerOriginal1742000000100
  implements MigrationInterface
{
  name = 'PartialUniqueIndexLedgerReversalPerOriginal1742000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'ledger_transactions'
        ) THEN
          CREATE UNIQUE INDEX IF NOT EXISTS "uq_ledger_reversal_per_original"
          ON "ledger_transactions" ("reverses_transaction_id")
          WHERE type = 'REVERSAL' AND reverses_transaction_id IS NOT NULL;
        END IF;
      END $do$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_ledger_reversal_per_original"`,
    );
  }
}
