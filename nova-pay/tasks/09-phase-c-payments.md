# Phase C — Payments

**Goal:** Payment orders, instructions, execution, user-facing transfer API.

**Prerequisite:** Phase B.

## Steps

- [ ] **PaymentOrder** lifecycle: created → validated → posted → completed / failed.
- [ ] **Idempotency-Key** header on mutating APIs; wire to IdempotencyRecord.
- [ ] **Transfer** use case: call posting engine inside one transaction; lock source account.
- [ ] **Outbox:** write event in same transaction as payment commit (task 04 names).
- [ ] **Publisher:** relay outbox to RabbitMQ.
- [ ] **APIs:** REST (or GraphQL if chosen) + Swagger docs for transfer and status query.
- [ ] **Read model:** payment history query (replica OK if eventual consistency documented).

## Acceptance criteria

- End-to-end transfer matches task 03 sequence for the MVP slice.
- Duplicate retry with same idempotency key returns same outcome, no double post.
