# Phase G — Compliance, reporting, observability

**Goal:** Audit trail, exports, structured logging, metrics, tracing hooks.

**Prerequisite:** Earlier phases emitting domain events and stable references.

## Steps

- [ ] **AuditEvent** writer: who/what/when on critical mutations (append-only).
- [ ] **Compliance** stubs: export job for regulator format (CSV/JSON) — spec from compliance owner later.
- [ ] **Structured logs:** JSON logs with `correlationId`, `userId`, `paymentId`, etc.
- [ ] **Metrics:** payment success/failure, batch progress, outbox lag, consumer lag (plan §16).
- [ ] **Tracing:** OpenTelemetry or vendor hook — propagate trace id from HTTP to MQ messages.
- [ ] **Dashboards** (optional): Grafana/Datadog definitions as code or doc links.

## Acceptance criteria

- Any payment can be traced from API request → ledger rows → outbox events → consumer logs.
- Runbooks for “outbox stuck” and “consumer DLQ growing” documented briefly in repo or ops wiki.
