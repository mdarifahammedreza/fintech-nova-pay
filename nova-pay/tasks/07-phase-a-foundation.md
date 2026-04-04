# Phase A — Foundation (NestJS)

**Goal:** Auth, users, shared kernel, config, database module, RabbitMQ wiring.

**Prerequisite:** Tasks 01–06 at least drafted; Postgres stack running.

## Steps

- [ ] **Config module:** env validation (`DATABASE_WRITE_URL`, `DATABASE_READ_URL`, `JWT_*`, `RABBITMQ_*`).
- [ ] **Database module:** TypeORM (or chosen ORM) with write/read DataSources; retire or relocate hit-counter demo.
- [ ] **Shared/common:** guards, pipes, filters, correlation-id middleware, money/decimal helpers (if used).
- [ ] **Users:** basic user entity + repository (minimal fields for MVP).
- [ ] **Auth:** JWT access + refresh; hashed refresh in DB; RBAC skeleton (roles enum from plan §15).
- [ ] **RabbitMQ:** connection module, health check, publish/subscribe test message.
- [ ] **Swagger:** tag groups per module; bearer auth in OpenAPI.
- [ ] **Docker-compose (optional):** local RabbitMQ service file under `infra/` mirroring Postgres style.

## Acceptance criteria

- App boots with **no** deprecated-driver warnings you care about (pg pin documented in `package.json` if still needed).
- One authenticated endpoint proves JWT + DB round-trip.
- One published message proves MQ from API path (even a stub event).
