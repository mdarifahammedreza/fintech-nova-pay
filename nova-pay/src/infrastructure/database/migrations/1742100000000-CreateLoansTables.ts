import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoansTables1742100000000 implements MigrationInterface {
  name = 'CreateLoansTables1742100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "loans_status_enum" AS ENUM (
          'DRAFT','PENDING_REVIEW','APPROVED','ACTIVE','OVERDUE','CLOSED','REJECTED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);
    await queryRunner.query(`
      DO $do$ BEGIN
        CREATE TYPE "loans_repayment_status_enum" AS ENUM (
          'PENDING','COMPLETED','FAILED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "borrower_user_id" uuid NOT NULL,
        "status" "loans_status_enum" NOT NULL DEFAULT 'DRAFT',
        "principalAmount" numeric(19,4) NOT NULL DEFAULT 0,
        "outstanding_principal" numeric(19,4) NOT NULL DEFAULT 0,
        "currency" "accounts_currency_enum" NOT NULL,
        "borrower_wallet_account_id" uuid,
        "loan_funding_account_id" uuid,
        "interest_rate_bps" integer,
        "term_months" integer,
        "maturity_date" TIMESTAMPTZ,
        "apply_idempotency_key" character varying(128),
        "apply_idempotency_scope_key" character varying(128),
        "disbursement_payment_id" uuid,
        "disbursement_correlation_id" character varying(128),
        "last_repayment_payment_id" uuid,
        "approved_at" TIMESTAMPTZ,
        "disbursed_at" TIMESTAMPTZ,
        "closed_at" TIMESTAMPTZ,
        "rejected_at" TIMESTAMPTZ,
        "marked_overdue_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loans" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_loans_apply_idempotency"
          UNIQUE ("apply_idempotency_key", "apply_idempotency_scope_key")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loans_borrower_user_id"
      ON "loans" ("borrower_user_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loans_status"
      ON "loans" ("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loans_maturity_date"
      ON "loans" ("maturity_date");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loan_repayments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loan_id" uuid NOT NULL,
        "amount" numeric(19,4) NOT NULL,
        "status" "loans_repayment_status_enum" NOT NULL DEFAULT 'PENDING',
        "payment_id" uuid,
        "payment_correlation_id" character varying(128),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loan_repayments" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loan_repayments_loan_id"
      ON "loan_repayments" ("loan_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loan_repayments_status"
      ON "loan_repayments" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "loan_repayments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loans"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "loans_repayment_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "loans_status_enum"`);
  }
}
