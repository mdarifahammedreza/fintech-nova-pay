# Agent / contributor notes

## Rules (read first)

| File | Purpose |
|------|---------|
| `.cursor/rules/global.md` | Always-on gate: pre-code checks; **no** architecture violations |
| `.cursor/rules/nova-architecture.md` | Canonical layout, CQRS folders, repository pattern, ledger & payment safety |

Do **not** duplicate architecture into new markdown files. Use **`setup/INSTRUCTIONS`** for setup notes.

## Layout summary

`src/main.ts`, `src/app.module.ts`, `src/common/*`, `src/infrastructure/*`, `src/modules/{auth,users,accounts,ledger,payments,shared}/` with `command/`, `query/`, `controller/`, `service/`, `repositories/`, `entities/`, `dto/`, `enums/`, `interfaces/`, `events/`, `*.module.ts` (no `schemas/` until explicitly adopted).

## Design context

- Narrative / phases: `project-plan.md`
- Task breakdown: `tasks/`
