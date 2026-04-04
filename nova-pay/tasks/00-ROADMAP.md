# NovaPay — task roadmap

Work **top to bottom**. Design tasks (**01–06**) should be completed (or at least drafted) before deep implementation of later phases; you can still use **Phase A** in parallel once **01** is clear.

| Order | File | Focus |
|------:|------|--------|
| 00 | `00-ROADMAP.md` | This index |
| 01 | `01-bounded-contexts.md` | Module ownership, tables, APIs (Phase 1A) |
| 02 | `02-core-entities-enums.md` | Business entities and enums |
| 03 | `03-money-movement-lifecycle.md` | Transfer / payroll / FX flows |
| 04 | `04-rabbitmq-event-map.md` | Events, producers, consumers, outbox |
| 05 | `05-db-schema-draft.md` | Tables, keys, indexes, module ownership |
| 06 | `06-invariants-failure-retry.md` | Rules, idempotency, retries, incidents |
| 07 | `07-phase-a-foundation.md` | Auth, users, shared, config, DB, RabbitMQ |
| 08 | `08-phase-b-accounts-ledger.md` | Accounts, ledger, idempotency, posting |
| 09 | `09-phase-c-payments.md` | Payment orders, execution, transfers |
| 10 | `10-phase-d-payroll.md` | Batches, reserve-once, child items |
| 11 | `11-phase-e-fx.md` | Quotes, rates, execution |
| 12 | `12-phase-f-fraud.md` | Sync + async risk, signals |
| 13 | `13-phase-g-compliance-observability.md` | Audit, reporting, metrics, tracing hooks |

**Already in place (from earlier work):** PostgreSQL primary + read replicas, Nest bootstrap, Swagger, hit-counter demo for read/write routing. Replace or narrow the demo as real modules land.

Reference: `project-plan.md` (full design narrative).
