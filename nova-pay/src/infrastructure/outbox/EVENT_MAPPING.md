# NovaPay outbox → external domain event contract

This document maps **internal** RabbitMQ routing keys (stored on `outbox_events.routing_key` and published verbatim by the relay) to **external** contract names expected by integrators (notifications, statements, regulatory adapters, legacy buses).

## Why we do not duplicate events in code

NovaPay writes **one** outbox row per business fact. Emitting a second row for the same commit (e.g. both `payment.completed` and `transaction.completed`) would:

- **Double publish** the same money outcome unless every consumer dedupes on business ids.
- **Break atomicity semantics** if one enqueue succeeded and a duplicate failed mid-transaction.
- **Inflate audit storage** with redundant rows that differ only by routing key string.

The canonical names remain in code as **`OutboxRoutingKey`** (`outbox-routing-key.enum.ts`). External systems that require a different vocabulary should **map at the subscription boundary** (BFF, integration worker, or broker topic-binding convention), not by adding duplicate outbox inserts in the monolith.

## Required mappings (internal → external)

Use these when translating `routingKey` (and optionally `payload.eventName` inside JSON) to your external contract.

| Internal routing key (`OutboxRoutingKey` / wire `routingKey`) | External contract name | Notes |
|--------------------------------------------------------------|-------------------------|--------|
| `payment.created` | `transaction.initiated` | Payment row materialized and moved to processing path; idempotency + payment id identify the logical transaction. |
| `payment.completed` | `transaction.completed` | Terminal success in the payment orchestration transaction (includes `ledgerTransactionId` in payload). |
| `payment.failed` | `transaction.failed` | Terminal failure; payload includes reason. |
| `ledger.transaction.reversed` | `transaction.reversed` | Compensating ledger post committed; maps to external “transaction reversed” (not a separate payment outbox row). |
| `fraud.risk.blocked` | `fraud.flag.raised` | High-severity / blocked outcome persisted with risk decision. |
| `fraud.risk.review_triggered` | `fraud.flag.raised` | Manual-review queue signal; same external “flag raised” family with different payload interpretation (`triggeredRuleTypes`, etc.). |
| `fraud.risk.action_required` | `fraud.flag.raised` | Step-up / OTP-style outcome; same external “flag raised” family; distinguish via payload fields (e.g. `reasonCode`). |
| `fraud.flag.resolved` | `fraud.flag.resolved` | Persisted decision cleared from `BLOCKED` or `REVIEW` to `APPROVED`; same wire name internally and externally. |

### Same external name, multiple internal sources

For **`fraud.flag.raised`**, three internal keys collapse to one external label. Consumers **must** branch on internal `routingKey` or payload fields (`eventName`, `riskDecisionId`, `finalDecision` context from your projection) to apply the correct workflow—**do not** assume all `fraud.flag.raised` events share identical payload shape beyond shared identifiers.

## Internal events without a row in this mapping

These are published as-is today; if an external contract lists them under other names, add a **consumer-side** mapping document in the integrating service—**do not** add a second outbox row in NovaPay without a new business fact.

Examples:

- `ledger.transaction.posted` — bundle-level ledger commit (not listed in your external `transaction.*` set; often mapped to internal accounting feeds rather than “transaction initiated/completed”).
- `account.created` / `account.frozen` / `account.unfrozen`
- `payroll.batch.created`
- `fx.rate.locked` / `fx.rate.lock.expired` / `fx.trade.executed` /
  `fx.international_transfer.created`

## Consumer checklist

1. Subscribe to NovaPay’s **actual** routing keys (or a single topic exchange with pattern bindings).
2. Apply **this mapping** when emitting to downstream buses that require `transaction.*` / `fraud.flag.raised`.
3. **Dedupe** on `messageId` (outbox row id) for at-least-once delivery.
4. Prefer **idempotent** handlers keyed by `paymentId`, `ledgerTransactionId`, or `riskDecisionId` as appropriate.
