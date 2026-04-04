# Task 01 — Bounded contexts and module ownership

**Goal:** Decide what each Nest module owns and exposes so the monolith stays coherent.

**Prerequisite:** Read `project-plan.md` §3–§5, §17–§18.

## Steps

- [ ] List final module names (align with plan: Identity, Accounts, Ledger, Payments, Payroll, FX, Fraud, Compliance, Notifications, Observability).
- [ ] For each module, write **one paragraph**: responsibility and **non-goals** (what it does *not* do).
- [ ] Assign **table ownership** (which module owns migrations for which tables) — draft OK; refine in task 05.
- [ ] For each module, list **HTTP API surface** (resource groups only, not every route): e.g. `Payments: /payments, /transfers`.
- [ ] Mark **internal-only** modules (no public HTTP): e.g. Ledger might be mostly internal to Payments/Payroll.
- [ ] Document **allowed dependencies** (directed graph): e.g. Payments → Ledger → Accounts; forbid cycles.
- [ ] Save the result as the team’s source of truth (update this file or a `docs/architecture` note if you add one later).

## Acceptance criteria

- Every domain from the plan has an owner module.
- No ambiguous ownership for **ledger postings** and **balances** (ledger-first rule).
- Dependency direction supports **PostgreSQL as source of truth**; no module “owns” RabbitMQ truth.

## Deliverable

A filled-in table (in this file or attached note):

| Module | Owns (tables / aggregates) | Public APIs | Publishes (events) | Consumes (events) | Depends on |
