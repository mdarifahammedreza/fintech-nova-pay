import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline users, accounts, auth, payments, ledger, payroll when
 * `synchronize=false`. Runs before `1740500000000-CreateOutboxEventsTable`.
 */
export class CreateCoreFinancialSchema1740400000000
  implements MigrationInterface
{
  name = 'CreateCoreFinancialSchema1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "users_role_enum" AS ENUM (
          'SUPER_ADMIN','ADMIN','CORPORATE','USER',
          'COMPLIANCE_OFFICER','FRAUD_ANALYST'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "accounts_currency_enum" AS ENUM (
          'USD','EUR','GBP','JPY','CHF','CAD','AUD'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "accounts_status_enum" AS ENUM (
          'PENDING','ACTIVE','FROZEN','CLOSED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "payments_idempotency_record_status_enum" AS ENUM (
          'PENDING','COMPLETED','FAILED','CONFLICT'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "payments_type_enum" AS ENUM (
          'INTERNAL_TRANSFER','PAYOUT','COLLECTION','FEE'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "payments_status_enum" AS ENUM (
          'PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "ledger_transactions_type_enum" AS ENUM (
          'TRANSFER','PAYMENT','REVERSAL','ADJUSTMENT','FEE','FX_CONVERSION'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "ledger_transactions_status_enum" AS ENUM (
          'PENDING','POSTED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "ledger_entries_entry_type_enum" AS ENUM (
          'DEBIT','CREDIT'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "payroll_batches_status_enum" AS ENUM (
          'DRAFT','FUNDING_RESERVED','DISBURSING',
          'COMPLETED','FAILED','CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "payroll_items_status_enum" AS ENUM (
          'PENDING','PROCESSING','COMPLETED','FAILED','SKIPPED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "payroll_runs_status_enum" AS ENUM (
          'DRAFT','SUBMITTED','CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "full_name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password" character varying(255) NOT NULL,
        "role" "users_role_enum" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email"
      ON "users" ("email");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "account_number" character varying(32) NOT NULL,
        "currency" "accounts_currency_enum" NOT NULL,
        "balance" numeric(19,4) NOT NULL DEFAULT 0,
        "available_balance" numeric(19,4) NOT NULL DEFAULT 0,
        "status" "accounts_status_enum" NOT NULL,
        "overdraft_limit" numeric(19,4) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_accounts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_accounts_user_id"
      ON "accounts" ("user_id");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_accounts_account_number"
      ON "accounts" ("account_number");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(128) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_refresh_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_refresh_user_id"
      ON "auth_refresh_tokens" ("user_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_refresh_token_hash"
      ON "auth_refresh_tokens" ("token_hash");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments_idempotency_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "idempotency_key" character varying(128) NOT NULL,
        "scope_key" character varying(128) NOT NULL DEFAULT '',
        "status" "payments_idempotency_record_status_enum" NOT NULL,
        "request_fingerprint" character varying(64),
        "linked_payment_id" uuid,
        "business_reference" character varying(128),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_idempotency" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_idempotency_key_scope"
          UNIQUE ("idempotency_key", "scope_key")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ledger_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" "ledger_transactions_type_enum" NOT NULL,
        "status" "ledger_transactions_status_enum" NOT NULL,
        "reverses_transaction_id" uuid,
        "correlation_id" character varying(128) NOT NULL,
        "memo" character varying(512),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ledger_transactions_correlation_id"
          UNIQUE ("correlation_id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_tx_status"
      ON "ledger_transactions" ("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_tx_type"
      ON "ledger_transactions" ("type");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ledger_reversal_per_original"
      ON "ledger_transactions" ("reverses_transaction_id")
      WHERE "type" = 'REVERSAL' AND reverses_transaction_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ledger_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ledger_transaction_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "entry_type" "ledger_entries_entry_type_enum" NOT NULL,
        "amount" numeric(19,4) NOT NULL,
        "currency" "accounts_currency_enum" NOT NULL,
        "line_number" integer NOT NULL,
        "memo" character varying(512),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_entries_tx" FOREIGN KEY ("ledger_transaction_id")
          REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_ledger_entries_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_entries_account"
      ON "ledger_entries" ("account_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_entries_tx_id"
      ON "ledger_entries" ("ledger_transaction_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" "payments_type_enum" NOT NULL,
        "status" "payments_status_enum" NOT NULL,
        "reference" character varying(128) NOT NULL,
        "idempotency_record_id" uuid NOT NULL,
        "source_account_id" uuid NOT NULL,
        "destination_account_id" uuid NOT NULL,
        "amount" numeric(19,4) NOT NULL,
        "currency" "accounts_currency_enum" NOT NULL,
        "ledger_transaction_id" uuid,
        "correlation_id" character varying(128),
        "memo" character varying(512),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_idempotency" FOREIGN KEY ("idempotency_record_id")
          REFERENCES "payments_idempotency_records"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_payments_source" FOREIGN KEY ("source_account_id")
          REFERENCES "accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_payments_dest" FOREIGN KEY ("destination_account_id")
          REFERENCES "accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_payments_idempotency_record_id"
          UNIQUE ("idempotency_record_id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_status"
      ON "payments" ("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_type"
      ON "payments" ("type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_reference"
      ON "payments" ("reference");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_correlation"
      ON "payments" ("correlation_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_batches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employer_account_id" uuid NOT NULL,
        "totalAmount" numeric(19,4) NOT NULL,
        "currency" "accounts_currency_enum" NOT NULL,
        "status" "payroll_batches_status_enum" NOT NULL DEFAULT 'DRAFT',
        "reference" character varying(128) NOT NULL,
        "idempotency_key" character varying(128) NOT NULL,
        "correlation_id" character varying(128),
        "external_batch_ref" character varying(128),
        "memo" character varying(512),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_batches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payroll_batches_employer" FOREIGN KEY ("employer_account_id")
          REFERENCES "accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_payroll_batches_employer_idempotency"
          UNIQUE ("employer_account_id", "idempotency_key")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_batches_employer"
      ON "payroll_batches" ("employer_account_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_batches_status"
      ON "payroll_batches" ("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_batches_correlation"
      ON "payroll_batches" ("correlation_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_batches_reference"
      ON "payroll_batches" ("reference");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL,
        "employee_account_id" uuid NOT NULL,
        "amount" numeric(19,4) NOT NULL,
        "currency" "accounts_currency_enum" NOT NULL,
        "status" "payroll_items_status_enum" NOT NULL DEFAULT 'PENDING',
        "item_reference" character varying(128) NOT NULL,
        "payment_id" uuid,
        "ledger_transaction_id" uuid,
        "memo" character varying(512),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payroll_items_batch" FOREIGN KEY ("batch_id")
          REFERENCES "payroll_batches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payroll_items_employee" FOREIGN KEY ("employee_account_id")
          REFERENCES "accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_payroll_items_batch_line"
          UNIQUE ("batch_id", "item_reference")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_items_employee"
      ON "payroll_items" ("employee_account_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_items_status"
      ON "payroll_items" ("status");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_funding_reservations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL,
        "reservedAmount" numeric(19,4) NOT NULL,
        "currency" "accounts_currency_enum" NOT NULL,
        "ledger_transaction_id" uuid,
        "reservationStatus" character varying(32) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_funding" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payroll_funding_batch" UNIQUE ("batch_id"),
        CONSTRAINT "FK_payroll_funding_batch" FOREIGN KEY ("batch_id")
          REFERENCES "payroll_batches"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "status" "payroll_runs_status_enum" NOT NULL DEFAULT 'DRAFT',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_runs" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_funding_reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_ledger_reversal_per_original"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_transactions"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "payments_idempotency_records"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payroll_runs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payroll_items_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payroll_batches_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "ledger_entries_entry_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "ledger_transactions_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "ledger_transactions_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_type_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "payments_idempotency_record_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "accounts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "accounts_currency_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
