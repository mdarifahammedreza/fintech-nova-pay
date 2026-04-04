# Phase D — Payroll

**Goal:** Batch upload, single employer reserve, idempotent per-employee credits, reconciliation.

**Prerequisite:** Phase C; payroll flow from task 03.

## Steps

- [ ] **PayrollBatch** + **PayrollItem** models and validation (totals, employee accounts).
- [ ] **Single reserve** on employer funding account for batch total (ledger + projection in one TX).
- [ ] Process items: credit employees **idempotently** (stable key per item).
- [ ] **Failure tracking** per item without failing entire batch unless policy says otherwise.
- [ ] **Batch summary** endpoint: counts, amounts, failures.
- [ ] **Events:** batch started, item paid, batch completed (per task 04).
- [ ] Load test sketch: simulate large batch without N concurrent debits on employer (plan §10).

## Acceptance criteria

- Design from plan §10 visible in code (one reserve, not N raw debits).
- Re-run safe: same batch idempotency does not double-pay employees.
