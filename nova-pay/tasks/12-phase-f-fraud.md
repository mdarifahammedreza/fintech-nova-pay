# Phase F — Fraud / risk

**Goal:** Layer 1 sync checks + layer 2 async consumers (plan §12).

**Prerequisite:** Phases C–D producing events; RabbitMQ stable.

## Steps

- [ ] **Sync rules** hook: before releasing funds / completing payment (velocity, blocklist, amount thresholds).
- [ ] **RiskDecision** persistence: allow / deny / review — integrate with payment state machine.
- [ ] **Async consumer:** subscribe to payment + ledger events; aggregate signals.
- [ ] **FraudSignal / FraudCase** minimal models for analyst review (stub UI optional).
- [ ] Metrics: fraud triggers, blocks, review queue depth (plan §16).

## Acceptance criteria

- Layer 1 blocks obviously bad requests before commit when policy requires it.
- Async path cannot move money; it only observes already-committed facts.
