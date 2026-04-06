# NovaPay

Banking-grade **modular monolith** (NestJS) for wallet-style accounts, payments, ledger, FX, payroll, loans, fraud, and transactional outbox events. PostgreSQL is the **source of financial truth**; RabbitMQ carries **async domain facts** after commit; Redis backs **fraud windows** and optional caching when `REDIS_URL` is set.

**Design references:** `.cursor/rules/nova-architecture.md`, `setup/INSTRUCTIONS`, Swagger UI at `/api` (disabled when `NODE_ENV=production`).

---

## 1. Project overview

NovaPay implements:

| Area | Role |
|------|------|
| **Accounts** | Multi-currency accounts; balance/available are **ledger projections**, not arbitrary updates. |
| **Payments** | Idempotent money movement via `PaymentOrchestratorService` + ledger posting + outbox in one DB transaction where applicable. |
| **Ledger** | Double-entry bundles (`LedgerTransaction` + `LedgerEntry`); reversals instead of mutating posted lines. |
| **FX** | 60s rate locks (`fx_rate_locks`); international transfer consumes a lock and records `fx_trades` + ledger in one transaction. |
| **Payroll** | Employer batches + line items; funding reservation and per-line payouts with item-level status for partial failure and retry. |
| **Loans** | Apply, disburse, repay, overdue sweep; money paths use **payments + ledger** public services only (no cross-module repos). |
| **Fraud** | Synchronous rule engine (`Promise.all` of five rules, ~200ms budget); fail-closed on errors or timeout. |
| **Outbox** | Domain events written in the **same** PostgreSQL transaction as business rows; relay publishes to RabbitMQ **after** commit. |

**Guarantees (architecture intent):** no “balance-only” money updates; ledger postings drive truth; idempotent payment APIs; FX locks expire and are single-use; fraud declines block the payment path before ledger post.

---

## 2. Setup & run

### Local (Docker)

From the **nova-pay repository root**:

```bash
./run-dev.sh
```

Or:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

**Migrate service:** A one-shot `migrate` container runs `npm run migration:run` after Postgres is healthy. The `app` service starts only when `migrate` exits **successfully** (`service_completed_successfully`). Schema is **not** auto-created by TypeORM (`DATABASE_SYNCHRONIZE=false`).

**Ports (host):**

| Service | Port | Notes |
|---------|------|--------|
| API | `3002` (compose) / see `PORT` in `.env` | Swagger: `http://localhost:<PORT>/api` |
| Postgres | `5432` | DB `fintech`, user/password in compose |
| Redis | `6380` → container `6379` | Avoids clash with a host Redis on `6379` |
| RabbitMQ AMQP | `5672` | |
| RabbitMQ Management | `15672` | Default user `guest` / `guest` |

### Local (manual)

```bash
npm ci
export DATABASE_WRITE_URL='postgresql://...'   # required for CLI + app
npm run migration:run
npm run start:dev
```

Default listen port in code is **3000** if `PORT` is unset (`src/main.ts`); `.env.example` and Docker use **3002**.

### Migration notes

| Command | Purpose |
|---------|---------|
| `npm run migration:run` | Apply pending migrations via `typeorm-ts-node-commonjs` and `src/infrastructure/database/data-source.ts`. |
| `npm run migration:revert` | Revert the last applied migration. |

**Data source:** Loads `.env` / `.env.local`; entities under `src/modules/**/*.entity.ts` and `src/infrastructure/outbox/*.entity.ts`; migrations under `src/infrastructure/database/migrations/*.ts` (or `dist/...` when `TYPEORM_DATASOURCE_USE_DIST=true`).

**FX schema:** Migration `1742200000000-CreateFxTables.ts` creates `fx_rate_locks` and `fx_trades` (and related enums). Without it, FX crons and flows fail with “relation does not exist”.

**Entity import:** `fx-trade.entity.ts` imports `./fx-rate-lock.entity` (extensionless). A prior `./fx-rate-lock.entity.js` import broke TypeORM CLI resolution under `ts-node`; extensionless keeps both Nest builds and `migration:run` working.

---

## 3. Environment configuration

Copy `.env.example` → `.env` and adjust. Important keys:

| Variable | Role |
|----------|------|
| `PORT` | HTTP port |
| `DATABASE_WRITE_URL` / `DATABASE_READ_URL` | Postgres (compose uses hostname `postgres` inside the stack) |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_DAYS` | Auth tokens |
| `RABBITMQ_URL`, `RABBITMQ_QUEUE`, … | Messaging; omit relay with `OUTBOX_RELAY_MODULE_DISABLED=true` for CI without a broker |
| `REDIS_URL` | Optional; fraud/redis-backed rules fail closed if Redis is down |
| `OUTBOX_*` | Relay batching / stale claim / retries |

See comments in `.env.example` for Docker-specific hostnames and Redis host port `6380`.

---

## 4. API summary

Base URL: `http://localhost:<PORT>` (replace `<PORT>`). Unless noted, protected routes expect:

`Authorization: Bearer <accessToken>`

### Auth (`/auth`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Register user; returns access + refresh tokens. |
| POST | `/auth/login` | Login; returns tokens. |
| GET | `/auth/session` | **Bearer required** — validate access token; returns `sub`, `email`, `role`. |

**Example — register**

```http
POST /auth/register
Content-Type: application/json

{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "hunter234!"
}
```

**Example — response (shape)**

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "expiresIn": 900
}
```

### Users (`/users`) — Bearer

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/lookup/by-email?email=` | Lookup user by email (admin-oriented; role guard TODO per controller). |
| GET | `/users/:id` | User by id. |

**Example — get by id**

```http
GET /users/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Example — response (shape)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "USER",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Accounts (`/accounts`) — Bearer

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/accounts` | Create account (`CreateAccountDto`). |
| GET | `/accounts?userId=` | List accounts for user (ownership checked). |
| GET | `/accounts/:id` | Get account (owner). |
| GET | `/accounts/:id/balance` | Balance projection. |
| GET | `/accounts/:id/statement` | Paginated ledger statement. |
| POST | `/accounts/:id/freeze` | Freeze (operational roles: `RolesGuard`). |
| POST | `/accounts/:id/unfreeze` | Unfreeze (same roles). |

### Payments (`/payments`) — Bearer

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/payments` | Create payment — **headers:** `Idempotency-Key` = body `idempotencyKey`. |
| GET | `/payments/lookup/by-reference?reference=` | By business reference. |
| GET | `/payments/:id` | Payment by id (`PaymentResponseDto` includes `ledgerTransactionId`, `paymentLedgerCorrelationId`). |

**Example — create internal transfer**

```http
POST /payments
Authorization: Bearer <token>
Idempotency-Key: pay-2026-001
Content-Type: application/json

{
  "idempotencyKey": "pay-2026-001",
  "idempotencyScopeKey": "",
  "type": "INTERNAL_TRANSFER",
  "reference": "INV-001",
  "sourceAccountId": "<uuid>",
  "destinationAccountId": "<uuid>",
  "amount": "100.0000",
  "currency": "USD"
}
```

**Example — response (shape)**

```json
{
  "id": "<uuid>",
  "type": "INTERNAL_TRANSFER",
  "status": "COMPLETED",
  "reference": "INV-001",
  "amount": "100.0000",
  "currency": "USD",
  "ledgerTransactionId": "<uuid>",
  "paymentLedgerCorrelationId": "payment:<paymentId>",
  "correlationId": null
}
```

### Transactions (`/transactions`) — Bearer (aliases)

Same payment pipeline with fixed `type`: `POST /transactions/transfer`, `/deposit`, `/withdraw`; `GET /transactions/:id`; `POST /transactions/:id/reverse` (ledger reversal — idempotency on `correlationId`).

### Ledger (`/ledger`) — Bearer

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ledger/transactions` | Post balanced bundle — `Idempotency-Key` = body `correlationId`. |
| POST | `/ledger/reversals` | Reverse posted transaction. |
| GET | `/ledger/transactions/:id` | Transaction + entries. |

### FX (`/fx/...`, `/transfers/international`) — Bearer

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/fx/lock-rate` | Create **60s** rate lock. |
| GET | `/fx/lock/:id` | Lock status + time remaining. |
| POST | `/transfers/international` | Consume lock + execute transfer — `Idempotency-Key` = body `idempotencyKey`. |

### Payroll (`/payroll`) — Bearer

Canonical paths include `jobs` aliases for `batches`:

- `POST /payroll/jobs` or `POST /payroll/batches` — create batch (idempotent header + body key).
- `POST /payroll/jobs/:jobId/process` or `POST /payroll/batches/:id/process` — process (fund + disburse).
- `GET /payroll/jobs/:jobId`, `GET /payroll/batches/:batchId/status` — status.
- `GET /payroll/jobs/:jobId/report`, `GET /payroll/batches/:batchId/report` — terminal report.
- `GET /payroll/batches/:id` — full batch + lines.

### Loans (`/loans`) — Bearer

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/loans/apply` | Loan application (borrower = JWT `sub`). |
| POST | `/loans/:id/disburse` | Disburse to wallet (idempotent payment fields in body). |
| POST | `/loans/:id/repay` | Repay from wallet. |
| GET | `/loans/:id` | Borrower-only read. |

### Fraud (`/fraud`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/fraud/evaluate` | Synchronous evaluation (documented as internal). |
| GET | `/fraud/risk-decisions?...` | Latest risk decision by payment reference. |

Controller notes **TODO** for strict JWT/operator policy on some routes — treat as **not fully hardened** for public internet.

---

## 5. Idempotency strategy (payments & aligned writes)

Storage: **`payments_idempotency_records`** keyed by **`(idempotency_key, scope_key)`** (unique). Each record links to a materialized payment when created.

| # | Scenario | Behavior |
|---|-----------|----------|
| 1 | **Same key + same payload** | Fingerprint matches stored request → same payment outcome returned (retry-safe). |
| 2 | **Same key + different payload** | **409 Conflict** — key reuse with altered body is rejected. |
| 3 | **Retry after success** | Payment already `COMPLETED` → same row returned without re-posting ledger. |
| 4 | **Concurrent requests, same key** | DB uniqueness + `FOR UPDATE` on idempotency row → one writer wins; others load the same payment. |
| 5 | **Failure then retry** | Terminal `FAILED` + idempotency `FAILED` stored → replay returns the same failed payment (no silent double-spend). |

**Header rule:** `Idempotency-Key` must match the body field (`idempotencyKey` or `correlationId` on ledger routes) — enforced in controllers.

---

## 6. Double-entry ledger

- Each money post creates one **`ledger_transactions`** row and multiple **`ledger_entries`**.
- **Invariant:** per currency, total debits = total credits (`assertBalancedPerCurrency` in `PostingService`).
- **Balances** on `accounts` are **projections** updated in the same transaction as entries (not standalone updates).
- **Corrections:** use **reversal** (`REVERSAL` type + `reversesTransactionId`) or compensating posts — historical lines are not edited in place.

---

## 7. FX strategy

- **Lock:** `POST /fx/lock-rate` persists an `ACTIVE` lock with **`expiresAt = now + 60 seconds`** (canonical TTL in product code).
- **Read:** `GET /fx/lock/:id` exposes `timeRemainingSeconds` from that expiry.
- **Single use:** International transfer consumes the lock (status moves to consumed) inside the same DB transaction as ledger settlement.
- **Ownership:** Handlers use JWT `sub` for the lock/trade user id.
- **Failure:** No silent fallback provider in the documented flow — failures surface as errors / failed states per handler logic.
- **Schema:** `1742200000000-CreateFxTables` must be applied so `fx_rate_locks` / `fx_trades` exist.

---

## 8. Payroll strategy

- **Batch:** `payroll_batches` + `payroll_items`; create is transactional with outbox `payroll.batch.created`.
- **Employer funding:** Orchestrator reserves/funds per batch design (see `PayrollOrchestratorService`).
- **Line idempotency:** `itemReference` unique per batch; lines move `PENDING` → `COMPLETED` / `FAILED` with stored `ledger_transaction_id` where posted.
- **Partial failure:** Failed lines retain status; successful lines stay completed.
- **Resumability:** Processing loops **skip non-`PENDING`** items and re-lock each line — rerunning process can continue remaining lines.

---

## 9. Fraud system

- **Sync path:** `FraudService.evaluateSynchronously` runs before payment hits ledger (inside payment orchestration transaction after account locks).
- **Five rules** (parallel `Promise.all`, **~200ms** budget race with timeout → synthetic fail-closed rows):
  1. **Velocity** — sender velocity window (Redis-backed when available).
  2. **Large transaction** — exceeds threshold; may emit `LARGE_AMOUNT_OTP` style outcome (see `ruleLargeTransaction` in code).
  3. **New device + large amount** — device registry vs amount.
  4. **Unusual hours** — hour-bucket pattern.
  5. **Recipient velocity** — distinct senders to recipient in window.
- **Decision states:** e.g. `APPROVED`, `BLOCKED`, `REVIEW`, `ACTION_REQUIRED` — only **APPROVED** continues to ledger on the payment path.
- **Fail-closed:** Engine errors, Redis outages for Redis-backed rules, or budget timeout → non-approval outcomes.

---

## 10. Outbox & events

- Rows in **`outbox_events`** written in the **same** SQL transaction as domain commits.
- **Relay:** `OutboxProcessorService` claims `PENDING` rows, publishes via RabbitMQ with **publisher confirms**, then marks `PUBLISHED` (or `FAILED` on publish error).
- **After commit:** Broker publish is **not** synchronous with the HTTP response; consumers see at-least-once delivery.
- **Dedupe:** Consumers should use **`messageId`** (outbox row id) for idempotent handling.
- Rows are **not** deleted when published (status tracks lifecycle).

Canonical routing keys: `OutboxRoutingKey` in `src/infrastructure/outbox/outbox-routing-key.enum.ts`. See `src/infrastructure/outbox/EVENT_MAPPING.md` for external naming notes.

---

## 11. Audit & integrity

- **Tracing:** Payment ↔ ledger linkage via `payment:{paymentId}` correlation id pattern; payments expose `ledgerTransactionId` and `paymentLedgerCorrelationId`.
- **Tamper detection / hash chain:** **Not implemented** in this codebase — ledger immutability relies on append-only postings + reversals, not cryptographic row chaining.

---

## 12. Tradeoffs & honesty

- **Modular monolith:** Deployed as one service; boundaries are module ownership, not separate network hops.
- **Fraud / users HTTP:** Some routes document **TODO** for `RolesGuard` / strict operator JWT — do not assume production RBAC everywhere.
- **Read replica:** `DATABASE_READ_URL` exists; local Docker often points both URLs at one Postgres for simplicity.
- **Defaults:** `main.ts` defaults port **3000**; many env files use **3002** — align `PORT` explicitly.

---

## 13. Production improvements (suggested)

- **Horizontal scaling:** Stateless API behind load balancer; **single** outbox relay coordination or partitioned claiming; **exactly-once** semantics still require consumer dedupe.
- **Observability:** Structured logs, metrics (latency, payment outcomes, relay backlog), tracing (correlation id propagation).
- **Alerting:** Relay failures, DLQ depth, DB replication lag, RabbitMQ disk/memory.
- **Consumers:** Dedicated workers for domain events; idempotent handlers keyed by business ids.
- **Security:** mTLS to broker, rotate JWT secrets, rate limits at gateway, tighten fraud/user route guards.
- **FX:** Real provider adapters, circuit breakers, explicit reconciliation jobs.

---

## Documentation & tooling

- **Architecture:** `.cursor/rules/nova-architecture.md`
- **Agent notes:** `AGENTS.md`, `setup/INSTRUCTIONS`
- **Swagger:** `GET /api` when not in production
- **Transaction ↔ payment mapping:** `docs/transactions-api-mapping.md`
