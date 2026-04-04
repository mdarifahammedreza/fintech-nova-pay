# Task 04 — RabbitMQ event map

**Goal:** Define event names, payloads (references, not full JSON), producers, and consumers.

**Prerequisite:** Tasks 01–03.

## Steps

- [ ] Choose **exchange topology** (e.g. topic per domain vs single domain-events exchange).
- [ ] List **domain events** with: `event.name`, version, producer module, consumer modules.
- [ ] Minimum payload contract: `eventId`, `occurredAt`, `correlationId`, domain refs (e.g. `paymentId`, `ledgerTxId`).
- [ ] Define **outbox** table ownership (likely Shared or Ledger) and publish cadence (polling vs log-based).
- [ ] Consumer **idempotency** strategy: dedupe key = `eventId` or business key + consumer name.
- [ ] Dead-letter / retry policy placeholders (detail in task 06).
- [ ] Events for: payment created, ledger posted, payroll batch started, FX quote accepted, fraud signals (async).

## Acceptance criteria

- No event is described as **source of financial truth** (plan §14).
- Every event has a **single owning producer** after commit.

## Template (copy rows)

| Event name | Producer | Consumers | Idempotency key |
