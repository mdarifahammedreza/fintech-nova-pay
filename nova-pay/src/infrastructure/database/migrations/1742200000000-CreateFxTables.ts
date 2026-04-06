import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFxTables1742200000000 implements MigrationInterface {
  name = 'CreateFxTables1742200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "fx_rate_locks_provider_enum" AS ENUM (
          'INTERNAL','MOCK','EXTERNAL'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "fx_rate_locks_status_enum" AS ENUM (
          'PENDING','ACTIVE','CONSUMED','EXPIRED','CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "fx_trades_provider_enum" AS ENUM (
          'INTERNAL','MOCK','EXTERNAL'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "fx_trades_status_enum" AS ENUM (
          'PENDING','COMPLETED','FAILED','CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fx_rate_locks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "source_currency" "accounts_currency_enum" NOT NULL,
        "target_currency" "accounts_currency_enum" NOT NULL,
        "source_amount" numeric(19,4) NOT NULL,
        "locked_rate" numeric(19,8) NOT NULL,
        "provider" "fx_rate_locks_provider_enum" NOT NULL,
        "provider_reference" character varying(256),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "consumed_at" TIMESTAMPTZ,
        "status" "fx_rate_locks_status_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fx_rate_locks" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fx_rate_locks_user_id"
      ON "fx_rate_locks" ("user_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fx_rate_locks_status"
      ON "fx_rate_locks" ("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fx_rate_locks_expires_at"
      ON "fx_rate_locks" ("expires_at");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fx_trades" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "rate_lock_id" uuid NOT NULL,
        "source_amount" numeric(19,4) NOT NULL,
        "source_currency" "accounts_currency_enum" NOT NULL,
        "target_amount" numeric(19,4) NOT NULL,
        "target_currency" "accounts_currency_enum" NOT NULL,
        "executed_rate" numeric(19,8) NOT NULL,
        "provider" "fx_trades_provider_enum" NOT NULL,
        "provider_reference" character varying(256),
        "status" "fx_trades_status_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fx_trades" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fx_trades_rate_lock_id" UNIQUE ("rate_lock_id"),
        CONSTRAINT "FK_fx_trades_rate_lock"
          FOREIGN KEY ("rate_lock_id")
          REFERENCES "fx_rate_locks"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fx_trades_user_id"
      ON "fx_trades" ("user_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fx_trades_rate_lock_id"
      ON "fx_trades" ("rate_lock_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fx_trades_status"
      ON "fx_trades" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fx_trades"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fx_rate_locks"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fx_trades_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fx_trades_provider_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fx_rate_locks_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "fx_rate_locks_provider_enum"`);
  }
}
