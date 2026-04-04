# Phase E — FX

**Goal:** Executable quotes, expiry, ledger posts with frozen rate metadata.

**Prerequisite:** Phase C (or B for ledger); FX entities from task 02.

## Steps

- [ ] **FxRate** ingestion (provider stub OK for dev).
- [ ] **FxQuote** API: create quote with expiry + provider ref; store immutable quote row.
- [ ] **Execution** API: validate `now < expiry` and quote unused/consumed state.
- [ ] **Ledger posting** includes quote id and rate snapshot on entries (plan §11).
- [ ] **Events:** quote created, conversion executed (task 04).
- [ ] Reject stale-rate execution paths in tests.

## Acceptance criteria

- No conversion uses “current rate” without a valid quote row tied to the transaction.
