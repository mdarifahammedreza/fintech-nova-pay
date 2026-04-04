# NovaPay

Modular NestJS fintech monolith: PostgreSQL as source of truth, ledger-first money movement, synchronous fraud checks, FX rate locks and international transfer orchestration, and **transactional outbox** integration with RabbitMQ (publish only after DB commit).

**Repository:** [github.com/mdarifahammedreza/fintech-nova-pay](https://github.com/mdarifahammedreza/fintech-nova-pay)

## Tech stack

- **Runtime:** Node.js, NestJS 11, TypeScript  
- **Database:** PostgreSQL, TypeORM, migrations  
- **Messaging:** RabbitMQ (domain events via outbox relay; publisher confirms)  
- **Cache:** Redis (fraud rules / optional infrastructure)  
- **API docs:** Swagger (`/api` when not in production)

## Implemented features by domain

### Users & authentication

- User management module; JWT-based auth module for identity and authorization.

### Accounts

- Account lifecycle (create, read, status updates) with balance projections maintained by ledger postings.
- **Outbox events** (same PostgreSQL transaction as the write):
  - `account.created`
  - `account.frozen` (transition into `FROZEN`)
  - `account.unfrozen` (`FROZEN` → `ACTIVE`)

### Ledger

- Double-entry postings: one `LedgerTransaction` and multiple `LedgerEntry` rows per post.
- Balance / available balance projections updated in the **same** transaction as ledger lines.
- Reversals as explicit `REVERSAL` transaction type.
- **Outbox:** `ledger.transaction.posted`, `ledger.transaction.reversed` (enqueued inside the posting transaction).

### Payments

- Idempotent payment submission (`Idempotency-Key` + stored idempotency records).
- Orchestrated flow: locked accounts → processing → ledger post → terminal status in **one** DB transaction.
- **Outbox:** `payment.created`, `payment.completed`, `payment.failed` in that money-path transaction.

### Fraud

- Synchronous risk evaluation before money release (fail-closed on engine / infrastructure errors).
- Persisted `RiskDecision` and per-rule `FraudSignal` rows in a single transaction.
- **Outbox** for non-approved outcomes (same transaction as persistence):
  - `fraud.risk.blocked`
  - `fraud.risk.action_required`
  - `fraud.risk.review_triggered`
- HTTP API for evaluation and risk-decision reads; Redis-backed rule execution where configured.
- Domain event classes (`FraudBlockedEvent`, etc.) used as outbox payload envelopes.

### FX (foreign exchange)

- **Rate lock:** live quote from provider (mock mode via env), persisted `FxRateLock` with TTL; **outbox** `fx.rate.locked` in the same transaction as insert.
- **International transfer:** consumes lock under row lock, creates `FxTrade`, emits **outbox** `fx.trade.executed` and `fx.international_transfer.created` in the same transaction (ledger/payment hooks documented as future `PostingService` / payment orchestration integration).
- CQRS-style commands/queries and thin `FxController`:
  - `POST /fx/lock-rate`
  - `GET /fx/lock/:id`
  - `POST /transfers/international` (requires `X-User-Id`, `Idempotency-Key` matching body)
- Domain event classes for future/async flows: `FxRateLockedEvent`, `FxRateLockExpiredEvent`, `FxTradeExecutedEvent`, `InternationalTransferCreatedEvent`.

### Payroll

- Batch and item entities, validation, orchestration scaffolding.
- **Outbox:** `payroll.batch.created` written in the **same** transaction as batch + line inserts when a new batch is persisted.
- Processing / funding paths remain TODO (stubs throw until implemented).

### Infrastructure: outbox & events

- **`outbox_events` table:** append-oriented; rows move `PENDING` → `CLAIMED` → `PUBLISHED` (or `FAILED`); not deleted after publish (audit-friendly).
- **Relay:** `OutboxRelayCronService` drains pending rows, publishes with **confirm channel**, then marks published; `SKIP LOCKED` + stale-claim reclaim for **multi-worker** safety.
- **Canonical routing keys:** `OutboxRoutingKey` enum — avoid raw string routing keys in application code.
- **No** direct RabbitMQ publish from HTTP handlers or domain services; only the outbox processor publishes after commit.

Architecture rules and module boundaries are summarized in [`.cursor/rules/nova-architecture.md`](.cursor/rules/nova-architecture.md).

## Configuration (high level)

- `DATABASE_*` / TypeORM connection for PostgreSQL  
- `RABBITMQ_URL` for relay and messaging (omit or set `OUTBOX_RELAY_MODULE_DISABLED=true` / `OUTBOX_RELAY_ENABLED=false` for local/CI without a broker)  
- `FX_PROVIDER_MOCK=true` for deterministic FX quotes in non-production setups  
- Redis URL where fraud or cache features expect it  

Use `.env` / `.env.local` as loaded in `AppModule`.

## Scripts

```bash
npm install
npm run build
npm run start:dev
npm run test
```

Swagger UI: `http://localhost:3000/api` (non-production).

## License

See `package.json` (`UNLICENSED` unless you change it).
