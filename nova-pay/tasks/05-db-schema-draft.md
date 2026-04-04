# Task 05 — Database schema draft

**Goal:** Table list, keys, indexes, and module migration ownership aligned with CQRS/read models if needed.

**Prerequisite:** Tasks 02–04 (entities + events inform tables).

## Steps

- [ ] One section per module: tables, PK/FK, critical **unique** constraints (idempotency keys, natural keys).
- [ ] Ledger tables: enforce **append-only** intent (no UPDATE on entries; reversals as new rows) — document how.
- [ ] Balance projection: table name, how updated (same TX as ledger post), and **rebuild** strategy sketch.
- [ ] Outbox table columns: `id`, `payload`, `type`, `createdAt`, `publishedAt`, etc.
- [ ] Indexes for hot paths: account id + createdAt, payment status, payroll batch id.
- [ ] Note **read replica** usage: which queries are OK on replica (reports) vs must hit primary (commands).
- [ ] Decide **migration tool** (TypeORM migrations vs raw SQL) and naming convention.

## Acceptance criteria

- Schema supports **no double spend** and **no duplicate idempotent operations** (unique constraints).
- Payroll “reserve once” has a clear representation (batch header + reservation row or ledger pattern).

## Output

ER sketch or bullet FK graph — enough for Phase B implementation without rework.
