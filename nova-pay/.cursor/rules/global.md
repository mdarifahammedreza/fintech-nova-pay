---
description: Global gate — architecture compliance before any NovaPay code
alwaysApply: true
---

# Global rules (NovaPay)

## Always follow

`.cursor/rules/nova-architecture.md` — canonical structure, **module ownership**,
**application layering**, repositories, **financial transaction boundary**,
idempotency, events/outbox, and safety rules.

If a request conflicts with it, follow **`nova-architecture.md`** (see its
**When uncertain** section). **Do not** generate code that violates it.

## Before generating any code

1. **Module structure** — Exact tree under `src/` and `modules/<name>/` per
   `nova-architecture.md` (no `schemas/` unless explicitly adopted later).
2. **Layering** — Controllers = transport; write logic in `command/`; read
   logic in `query/`; shared orchestration in `service/`; persistence only in
   `repositories/`.
3. **Module ownership** — No cross-module repository access; only public APIs /
   exported services / events.
4. **Repository pattern** — `BaseRepository<T>` in infrastructure; thin module
   repos; **no** validation, orchestration, or domain decisions in repos.
5. **Financial safety** — One PG transaction for the full money path
   (idempotency → lock → validate → ledger → projection → outbox → commit);
   ledger-first; idempotency stored in Postgres; events via outbox after commit.

## If something would violate architecture

**Do not generate that code.** Explain the conflict and propose a compliant
approach, or use explicit `TODO`s instead of unsafe shortcuts.

## Documentation files

Do **not** add new `.md` files unless the user explicitly asks. Extend
**`setup/INSTRUCTIONS`** (plain text) for setup notes.
