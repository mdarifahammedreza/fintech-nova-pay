# Task 06 — Invariants, failure handling, and retry

**Goal:** Rules that must always hold + what happens when things break.

**Prerequisite:** Tasks 03–05.

## Steps

### Invariants (plan §2, §9)

- [ ] Document each core guarantee as a testable invariant (e.g. “sum of ledger entries per tx = 0 in base currency”).
- [ ] Non-negative balance (unless overdraft policy) — how enforced in code + DB.
- [ ] Idempotency: API key + business ref + consumer dedupe — three layers (plan §13).

### Failures

- [ ] API timeout after DB commit but before response — client retry behavior and idempotency key.
- [ ] Outbox publisher crash — recovery via unpublished rows.
- [ ] Consumer crash mid-handler — at-least-once + idempotent handler.
- [ ] RabbitMQ unavailable — core API still accepts? (define degradation).

### Retries

- [ ] Which operations are **never** auto-retried without idempotency (external PSP webhooks, etc.).
- [ ] Backoff and max attempts for async consumers.
- [ ] Human escalation path for stuck payroll / stuck payments.

## Acceptance criteria

- No retry story allows **duplicate money movement** without idempotency.
- Incidents are **observable** (log fields + metrics hooks) per plan §16.
