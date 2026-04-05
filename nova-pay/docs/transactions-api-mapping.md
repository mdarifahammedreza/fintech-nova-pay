# Transaction API contract ↔ NovaPay internals

Public routes under **`/transactions`** are **thin aliases**. All money rules,
idempotency, fraud, ledger posting, and outbox behavior stay in the existing
**payments** and **ledger** command handlers.

| HTTP contract | Handler / canonical route | Notes |
|---------------|-------------------------|-------|
| `POST /transactions/transfer` | `CreatePaymentHandler` (`POST /payments`) | Body = `CreatePaymentDto` **without** `type`; server sets `type: INTERNAL_TRANSFER`. |
| `POST /transactions/deposit` | `CreatePaymentHandler` | Sets `type: COLLECTION`. Caller must own **destination**; source may be funding/settlement. |
| `POST /transactions/withdraw` | `CreatePaymentHandler` | Sets `type: PAYOUT`. Caller must own **source** (same as other debits). |
| `GET /transactions/:id` | `GetPaymentByIdHandler` (`GET /payments/:id`) | `:id` is **`payments.id`**. |
| `POST /transactions/:id/reverse` | `ReverseLedgerTransactionHandler` (`POST /ledger/reversals`) | `:id` is **`ledger_transactions.id`** (posted tx to reverse). Body = reversal fields **without** `originalLedgerTransactionId`; `Idempotency-Key` = `correlationId`. |

**Ledger read for raw bundles:** `GET /ledger/transactions/:id` (unchanged).

**Payment create with explicit type:** `POST /payments` (unchanged).

## Linking a payment to its ledger posting (two-step, no duplicated lines)

Payment read bodies (`GET /payments/:id`, `GET /transactions/:id`) always include:

- **`ledgerTransactionId`** — UUID of the posted `ledger_transactions` row when the
  payment reached `COMPLETED`; `null` while pending/failed or before posting.
- **`paymentLedgerCorrelationId`** — `payment:{payments.id}`; matches the ledger
  transaction’s `correlationId` for the orchestrator’s primary post (stable even
  before `ledgerTransactionId` is known to the client).

**Recommended client flow**

1. `GET /payments/{id}` or `GET /transactions/{id}`.
2. If `ledgerTransactionId` is non-null → `GET /ledger/transactions/{ledgerTransactionId}`
   for authoritative debit/credit lines and headers. Do not treat payment JSON as
   a substitute for ledger entries.

If `ledgerTransactionId` is still null (processing or failure), wait/retry the
payment read or subscribe to outbox-driven events; the correlation id is still
useful for log/support alignment.
