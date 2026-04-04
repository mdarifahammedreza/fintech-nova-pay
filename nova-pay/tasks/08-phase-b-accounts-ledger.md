# Phase B — Accounts, ledger, idempotency, posting engine

**Goal:** Account model, ledger-first postings, idempotency store, internal posting API.

**Prerequisite:** Phase A; schema draft for accounts + ledger (task 05).

## Steps

- [ ] **Accounts:** create/list account; status; multi-currency if in MVP; link to user/corporate.
- [ ] **Row-level locking** helper or pattern for “debit source” use cases.
- [ ] **LedgerTransaction + LedgerEntry:** create in one DB transaction; no silent updates to historical entries.
- [ ] **Balance projection** update in same transaction as entries.
- [ ] **IdempotencyRecord:** store request key + response hash or business outcome; TTL or cleanup policy.
- [ ] **Posting service (internal):** single entry point used by Payments later: `postTransfer(...)`, returns stable refs.
- [ ] **Unit tests** for: concurrent debits on same account (integration test with parallel requests).
- [ ] **Read paths:** optional read-replica repository for account list/report queries only.

## Acceptance criteria

- Transfer-style operation cannot pass two concurrent debits beyond available balance (plan §9).
- Posting API is the **only** blessed way to mutate balances (no ad hoc `balance +=` elsewhere).
