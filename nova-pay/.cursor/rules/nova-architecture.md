---
description: >-
  NovaPay modular monolith — canonical architecture, module boundaries,
  repositories, ledger, and financial safety rules
---

# NovaPay architecture (canonical)

Single source of truth for structure and money rules. Update this file whenever
architecture changes.

## System

- Modular monolith (extractable later)
- NestJS API
- PostgreSQL = source of truth
- RabbitMQ = async domain events, never financial truth
- Redis = cache / rate limiting when enabled

## Core principles

1. Ledger-first: never mutate account balance as the only step; ledger postings
   drive truth.
2. Every money path is idempotent at API, business, and consumer layers.
3. No negative available balance unless overdraft policy explicitly allows it.
4. Money movement is atomic in one PostgreSQL transaction where applicable.
5. Domain events leave via outbox in the same DB transaction as the write.
6. Fraud uses sync checks before releasing funds; async consumers observe facts
   only.
7. FX executes only against a valid stored quote with expiry and provider
   reference.
8. Critical flows are fully auditable with actor, action, reference, and
   correlation IDs.

## `src` layout (mandatory)

```text
src/
  main.ts
  app.module.ts
  common/
    constants/
    decorators/
    dto/
    enums/
    exceptions/
    filters/
    guards/
    interceptors/
    interfaces/
    pipes/
    types/
    utils/
  infrastructure/
    config/
    database/
      database.module.ts
      data-source.ts
      migrations/
      repositories/
        base.repository.ts
        transaction.repository.ts
        pagination.repository.ts
      helpers/
        query-options.helper.ts
        pagination.helper.ts
      postgres/
        postgres.module.ts
    messaging/
      rabbitmq.module.ts
      rabbitmq.service.ts
      publishers/
      consumers/
    auth/
      jwt.strategy.ts
      jwt-refresh.strategy.ts
      jwt-auth.guard.ts
      roles.guard.ts
    cache/
      redis.module.ts
      redis.service.ts
  modules/
    auth/
    users/
    accounts/
    ledger/
    payments/
    shared/
```

## Module structure (exact)

Each `modules/<name>/` must follow **exactly**:

```text
<name>/
  command/
    handlers/
    impl/
  query/
    handlers/
    impl/
  controller/
  service/
  repositories/
  entities/
  dto/
  enums/
  interfaces/
  events/
  <name>.module.ts
```

(No `schemas/` unless you later add Mongoose, Zod, or dedicated event-schema
layers — until then, TypeORM `entities/` is enough.)

## Application layering

- `controller/`: transport only
- `command/impl/`: write use-case definitions
- `command/handlers/`: execute write use-cases
- `query/impl/`: read use-case definitions
- `query/handlers/`: execute read use-cases
- `service/`: reusable domain/application services used by handlers
- `repositories/`: persistence only

## Module ownership

- Each module owns its entities, repositories, DTOs, enums, events, and
  services.
- Other modules must **not** directly access another module's repositories.
- Cross-module interaction must happen through exported services, commands, or
  events.
- No module may write another module's tables except through the owning
  module's public API.

## Repository pattern

- Extend or use `BaseRepository<T>` from
  `infrastructure/database/repositories/`.
- Shared repository utilities live **only** in infrastructure.
- `BaseRepository<T>` may contain generic helpers: `findById`, `save`, `exists`,
  `paginate`, etc.
- Module repositories may extend it but **only** for module-specific
  persistence queries.
- Repositories must **not** contain business validation, orchestration, or
  domain decisions.

## Financial transaction boundary

For any money-moving operation:

- idempotency check
- lock source account row
- validate available balance and overdraft
- create ledger transaction
- create ledger entries
- update account balance projection
- write outbox event
- commit

These steps must happen in **one** PostgreSQL transaction where applicable.
**Never** split balance check and debit/post into separate transactions.

## Ledger

- Each financial post creates one `LedgerTransaction` and multiple `LedgerEntry`
  rows.
- Use debit and credit entries explicitly.
- Do not `UPDATE` historical ledger rows to fix money; use reversal or
  compensating postings.
- Account balance is a **projection** updated in the same transaction as ledger
  posting or rebuilt from ledger.

## Payments

- Mutating APIs require idempotency handling with `Idempotency-Key` and stored
  outcome.
- Source account validation must happen with the source row **locked** in the
  same transaction as posting.
- Emit payment events per **Event rules** (names as constants/enums, outbox,
  same transaction).

## Idempotency

- All mutating money APIs must accept an idempotency key.
- Idempotency records must be stored in **PostgreSQL**.
- The stored record must link request identity to final outcome / reference.
- Retries must return the previously completed result, **not** execute again.
- MQ consumers must apply **consumer-level** deduplication.

## Event rules

- Domain event names must be **constants/enums**, never raw strings.
- Events are written to **outbox** inside the same DB transaction as the
  business write.
- RabbitMQ publishing happens **only** from outbox processing **after** commit.
- Canonical routing keys live in `OutboxRoutingKey` (no duplicate literals).
- Payment: `payment.created`, `payment.completed`, `payment.failed`
- Ledger: `ledger.transaction.posted`, `ledger.transaction.reversed`
- Fraud (non-APPROVED outcomes): `fraud.risk.blocked`,
  `fraud.risk.action_required`, `fraud.risk.review_triggered`
- Accounts: `account.created`, `account.frozen`, `account.unfrozen`
- Payroll: `payroll.batch.created` (same TX as batch + line insert)
- FX: `fx.rate.locked`, `fx.trade.executed`,
  `fx.international_transfer.created`

## Coding

- Enums instead of magic strings for statuses and types.
- DTO validation with `class-validator`.
- Swagger decorators on DTOs and controllers.
- `async/await`.
- Single quotes and semicolons.
- Prefer small, focused files, services, and repositories; avoid oversized
  types.

## JWT

- JWT is for identity and authorization only.
- JWT is **not** a substitute for idempotency, transaction boundaries, or
  database constraints.

## Do not

- Directly mutate balance without ledger posting.
- Skip idempotency on money APIs.
- Break module ownership by reaching into another module's repositories.
- Create god services that mix unrelated domains.
- Publish RabbitMQ events as source of truth before DB commit.

## When uncertain

If a request conflicts with this file:

- Follow **this architecture file** over ad hoc instructions.
- Do **not** generate shortcuts that violate financial correctness.
- Prefer explicit `TODO` comments over unsafe assumptions.

## Reference

- Design narrative and phases: `project-plan.md`
- Bounded-context tasks: `tasks/`
