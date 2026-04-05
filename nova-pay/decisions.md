# Architecture decisions

## Payroll employer-account serialization (bulk funding debits)

**Context:** Many payroll batches can debit the same employer account. Concurrent
funding posts must not race on available-balance checks versus ledger writes.

**Chosen approach:** `pg_advisory_xact_lock` inside the **same PostgreSQL
transaction** as the employer → clearing funding post (`PayrollEmployerFundingLockService`).

**Why not BullMQ (single-writer queue per employer) here**

- NovaPay already depends on PostgreSQL for financial truth; advisory locks give
  **cluster-wide serialization** for the critical section without new runtime
  components (Redis queue workers, job schema, failure/retry policy duplication).
- The risky overlap is **short**: only the funding transaction debits the
  employer. Line payouts debit **clearing → employee**, so they do not require
  the same employer lock and can run in parallel across batches.
- `pg_advisory_xact_lock` is **transaction-scoped**: it releases when the funding
  transaction commits or rolls back, so connection pooling does not leak locks
  (unlike session-level advisory locks spanning multiple queries).

**What stays the same**

- Funding remains one atomic money transaction with ledger + projections + payroll
  rows + outbox.
- Batch and line **idempotency** (ledger `correlationId`, item state) is unchanged.
- **Partial failure** after funding: per-line transactions and `FAILED` items /
  batch terminal state remain visible as today.

**When BullMQ (or similar) would be appropriate**

- Long-running or cross-service employer workflows where the critical section is
  wider than a single DB transaction.
- Explicit back-pressure, delayed retries, or operator dashboards tied to job
  queues.
