Good. First we design, then we code.

# NovaPay project plan

Canonical **architecture, folder layout, repository pattern, ledger/payment rules, and financial safety** live in:

- `.cursor/rules/nova-architecture.md` (single source — edit there, not here)
- `.cursor/rules/global.md` (always-on gate for agents: pre-code checks; no violations)

Setup steps (avoid extra markdown in the repo): `setup/INSTRUCTIONS`.

---

For **NovaPay**, the right starting point is not JWT or RabbitMQ setup.
The right starting point is defining the **system boundaries, money flow, guarantees, and failure rules**.

So let’s begin with **System Design Phase 1: Foundations**.

# 1. What we are building

NovaPay is no longer just a wallet.

It is a **financial transaction platform** that must support:

* wallet accounts
* payroll disbursement
* bill payments
* internal transfers
* international transfer with FX
* fraud detection
* audit/compliance
* high concurrency
* strict money correctness

That means the backend must be designed like a **banking-grade transaction system**, not like a normal CRUD SaaS app.

---

# 2. First design principle

Before modules, databases, or queues, define the **non-negotiable guarantees**.

## Core guarantees

The system must guarantee:

1. **No transaction executes twice**
2. **No account goes negative unless explicitly allowed**
3. **Every money movement is traceable**
4. **Every money movement is reversible through compensating action, not silent mutation**
5. **FX rate must be locked before execution**
6. **Fraud detection must see events immediately**
7. **Incidents must be observable in real time**
8. **Async retry must not duplicate money**
9. **System failure must not corrupt ledger state**

These are the real backbone of the design.

---

# 3. High-level architecture choice

For your case, the best first architecture is:

## **Modular Monolith with event-driven internal design**

Why:

* easier to build correctly in NestJS
* simpler than full microservices
* still allows domain separation
* better transactional consistency for money movement
* RabbitMQ can still be used for async processing
* later we can extract heavy modules into services

So first target:

* **NestJS modular monolith**
* **PostgreSQL as source of truth**
* **RabbitMQ for domain events and async workflows**
* **JWT for auth**
* **Redis optional later for cache / rate limiting / counters**

---

# 4. Core domains

We should split NovaPay into bounded domains first.

## Suggested domains

### 1. Identity & Access

Handles:

* users
* corporate clients
* roles
* JWT auth
* session / refresh token logic

### 2. Accounts

Handles:

* wallet accounts
* multi-currency accounts
* account status
* overdraft policy

### 3. Ledger

Handles:

* financial postings
* debit/credit entries
* immutable transaction records
* balance projection

### 4. Payments

Handles:

* transfer requests
* bill pay
* payout instructions
* payment lifecycle

### 5. Payroll

Handles:

* employer batch upload
* payroll execution
* employee disbursement

### 6. FX

Handles:

* exchange rates
* executable quotes
* quote expiry
* currency conversion

### 7. Fraud / Risk

Handles:

* real-time fraud screening
* rule evaluation
* suspicious activity detection
* risk holds

### 8. Compliance / Audit

Handles:

* audit trail
* regulator export
* suspicious case records
* financial history traceability

### 9. Notifications

Handles:

* email
* SMS
* push
* webhooks

### 10. Observability

Handles:

* structured logs
* trace IDs
* metrics
* monitoring hooks

---

# 5. Which domains to build first

We should not design all domains in equal depth now.

## First design priority

Start with these four:

* **Identity & Access**
* **Accounts**
* **Ledger**
* **Payments**

Because these are the minimum backbone.

Without these, payroll, FX, and fraud cannot stand correctly.

---

# 6. Most important design decision: ledger-first

This is critical.

NovaPay failed because money logic was probably based on direct balance mutation.

## Wrong approach

```ts
account.balance -= amount;
receiver.balance += amount;
```

This is dangerous.

## Correct approach

Use **ledger-first accounting**.

Every financial transaction must create immutable ledger records.

That means:

* account is a business object
* ledger transaction is the financial event
* ledger entries are debit/credit records
* balance is derived from ledger or maintained as a projection

So system truth becomes:

* **ledger = source of truth**
* **balance = read model / projection / snapshot**

---

# 7. Core data model at business level

Not DB-level yet. Just conceptually.

## Identity

* User
* Role
* Session / RefreshToken
* CorporateClient

## Accounts

* Account
* AccountLimit
* OverdraftPolicy

## Ledger

* LedgerTransaction
* LedgerEntry
* Hold / Reservation
* Reversal

## Payments

* PaymentOrder
* PaymentInstruction
* PaymentExecution
* IdempotencyRecord

## Payroll

* PayrollBatch
* PayrollItem
* PayrollExecution

## FX

* FxRate
* FxQuote
* FxTrade

## Fraud

* FraudSignal
* RiskDecision
* FraudCase

## Audit

* AuditEvent
* ComplianceCase

---

# 8. Core transaction flow

Before coding, we must define how money moves.

## Example: user transfer

When user A sends money to user B:

1. authenticate request
2. validate idempotency key
3. validate payment request
4. lock source account
5. check available balance
6. check account status
7. create payment order
8. create ledger transaction
9. create debit entry on source account
10. create credit entry on destination account
11. update balance projection
12. store outbox event
13. commit DB transaction
14. publish async events through RabbitMQ
15. notify fraud / notification / audit consumers

Important:
**Money movement must commit in PostgreSQL before async consumers act on it.**

---

# 9. Concurrency strategy

This is where the old system died, so we design it early.

## Rule

For critical debit operations:

* lock the source account row
* validate current available balance
* post transaction in one DB transaction

For PostgreSQL this generally means:

* row-level locking
* strict transactional boundary
* no separated balance-check and debit-write steps

### Why

Because this bug happened before:

* balance checked in one step
* debit happened in another
* concurrent requests slipped through

So NovaPay must use:
**check + reserve/post = same transaction**

---

# 10. How payroll must be designed differently

The old system got hit by 14,000 salary debit requests at once.

That must never happen again.

## Correct payroll design

For a payroll batch:

1. employer uploads payroll batch
2. system validates payroll items
3. system calculates total payroll amount
4. system locks employer funding account once
5. system reserves total amount once
6. system creates child payroll items
7. each item credits employee account idempotently
8. failed items are tracked individually
9. batch finishes with reconciliation summary

So:

* **one reserve on employer account**
* not **14,000 simultaneous raw debits**

This is a major design requirement.

---

# 11. How FX must be designed

The old system used stale rates.

So we define:

## FX rule

No FX transaction executes using “whatever current rate exists later.”

Instead:

1. user requests conversion
2. system fetches live rate
3. system creates **FxQuote**
4. quote includes:

   * rate
   * source currency
   * destination currency
   * expiry time
   * provider reference
5. user confirms
6. execution is allowed only if quote is still valid
7. ledger posting stores quote details permanently

So:

* **quote is executable contract**
* not just an informational rate

---

# 12. Fraud design rule

Fraud cannot be a cron job.

## Fraud must have two layers

### Layer 1: synchronous checks

Runs before critical execution or release of funds

Examples:

* velocity threshold
* duplicate same beneficiary transfer
* sudden large payroll anomaly
* blocked user / flagged account

### Layer 2: asynchronous checks

Runs after event publication

Examples:

* behavioral analysis
* pattern aggregation
* network relationships
* compliance reporting

So RabbitMQ helps here:

* payment created
* transaction posted
* withdrawal initiated
* payroll batch started

These events can feed fraud consumers immediately.

---

# 13. Reliability rule: idempotency everywhere

This must be designed before APIs.

## We need 3 layers of idempotency

### API idempotency

Client sends an `Idempotency-Key`

### Business idempotency

Stable business reference, like:

* transfer reference
* payroll item reference
* FX execution reference

### Consumer idempotency

RabbitMQ consumers must deduplicate event handling

Without all three, retries can duplicate money.

---

# 14. Async messaging rule with RabbitMQ

RabbitMQ is for **event distribution and decoupling**, not for core financial truth.

## PostgreSQL owns truth

Core transaction must be committed in DB first.

## RabbitMQ handles

* fraud event processing
* notifications
* audit side workflows
* reporting updates
* reconciliation tasks
* payroll child processing
* FX downstream workflows

Best pattern:

* write DB transaction
* store outbox event in same DB transaction
* publish from outbox reliably
* consumers handle events idempotently

---

# 15. Security design basics

Since you want JWT:

## JWT design

Use:

* access token
* refresh token
* hashed refresh token in DB
* role-based authorization
* device/session tracking if possible later

Roles may look like:

* SUPER_ADMIN
* ADMIN
* CORPORATE
* USER
* COMPLIANCE_OFFICER
* FRAUD_ANALYST

JWT is for identity and authorization, but **JWT must not be used as transaction safety**.
Money correctness must stay in DB and domain logic.

---

# 16. Observability design from day one

NovaPay had no distributed tracing and engineers were blind.

So first design must include:

* request ID
* correlation ID
* transaction reference
* structured logs
* queue message ID
* processing latency metrics
* failure counters
* lock wait metrics
* payment success/failure ratio
* payroll batch progress metrics
* fraud trigger metrics
* FX quote expiration metrics

Even before full tracing, at minimum:

* every request gets correlation ID
* every domain event carries reference IDs
* every critical transaction has stable reference

---

# 17. Recommended module order in NestJS

When we start actual implementation later, I’d do this order:

## Phase A

* auth
* users
* shared/common
* config
* database
* rabbitmq infrastructure

## Phase B

* accounts
* ledger
* idempotency
* transaction posting engine

## Phase C

* payments

## Phase D

* payroll

## Phase E

* FX

## Phase F

* fraud

## Phase G

* compliance / reporting / reconciliation

---

# 18. First architecture draft

This is the first clean system picture:

```text
Clients / Admin / Corporate APIs
        |
     NestJS API Layer
        |
 -------------------------------------------------
 | Auth | Users | Accounts | Ledger | Payments   |
 | Payroll | FX | Fraud | Compliance | Shared    |
 -------------------------------------------------
        |
   PostgreSQL (source of truth)
        |
   Outbox Publisher
        |
     RabbitMQ
        |
 -----------------------------------------------
 | Fraud Consumer | Notification Consumer       |
 | Audit Consumer | Reporting Consumer          |
 | Payroll Worker | FX Worker                   |
 -----------------------------------------------
```

---

# 19. First design deliverables we should define next

Before writing Cursor prompts, we should produce these artifacts:

### A. Domain boundaries

Which module owns what

### B. Core entities

Only business-level first

### C. Transaction flows

For:

* transfer
* payroll
* FX conversion

### D. Invariants

Rules that must always remain true

### E. Event list

RabbitMQ event names and producers/consumers

### F. Database ownership

Which tables belong to which module

### G. Failure and retry strategy

What happens if a worker crashes

---

# 20. Best next step

Now we should do this in order:

## Step 1

Define **bounded contexts and ownership**

## Step 2

Define **core entities and enums**

## Step 3

Define **money movement lifecycle**

## Step 4

Define **RabbitMQ event map**

## Step 5

Define **DB schema draft**

---

I suggest we start right now with:

# **NovaPay Phase 1A — Bounded Contexts and Module Ownership**

and I can draft it for NestJS in a very practical format like:

* module name
* responsibility
* owns which tables
* publishes which events
* consumes which events
* APIs it exposes

That is the best next move.
