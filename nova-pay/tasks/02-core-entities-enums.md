# Task 02 — Core entities and enums

**Goal:** Freeze business-level entities before coding schemas (task 05).

**Prerequisite:** Task 01 drafted.

## Steps

- **Identity:** User, Role, Session/RefreshToken, CorporateClient — attributes and relationships (text diagram OK).
- **Accounts:** Account, AccountLimit, OverdraftPolicy — currencies, status enum, link to User/Corporate.
- **Ledger:** LedgerTransaction, LedgerEntry, Hold/Reservation, Reversal — debit/credit rules, immutability notes.
- **Payments:** PaymentOrder, PaymentInstruction, PaymentExecution, IdempotencyRecord — lifecycle states enum.
- **Payroll (later):** PayrollBatch, PayrollItem, PayrollExecution — states enum.
- **FX (later):** FxRate, FxQuote, FxTrade — quote expiry and “executable contract” fields.
- **Fraud (later):** FraudSignal, RiskDecision, FraudCase — decision enum.
- **Audit:** AuditEvent, ComplianceCase — minimum fields for traceability.
- List **global enums** in one place: `AccountStatus`, `PaymentStatus`, `LedgerEntryType`, `Currency`, etc.
- Mark entities as **MVP (Phase B/C)** vs **later** to avoid scope creep.

## Acceptance criteria

- No “balance” stored as the only truth without ledger linkage (plan §6).
- Idempotency record is a first-class concept, not an afterthought.
- FX quote entity includes **expiry** and **provider reference** (plan §11).

## Checklist summary

- Entity list reviewed against plan §7.
- Enums named and documented.
- MVP subset explicitly flagged for first implementation wave.

