# PostgreSQL CQRS layout (1 write, 2 read replicas)

Local **streaming replication** stack for a fintech-style app: **one primary** for writes (commands) and **two standbys** for reads (queries). This mirrors a common CQRS data path: mutations on the writer, selects on readers with optional load balancing.

## What is in this folder

| File | Role |
|------|------|
| `docker-compose.yml` | Primary + two replica services, volumes, health checks |
| `Dockerfile.replica` | Thin image that runs `pg_basebackup` once, then normal Postgres |
| `replica-entrypoint.sh` | Bootstraps empty replica data directories from the primary |
| `init-primary/01-replication-user.sh` | Creates `replicator` and `pg_hba` rules (runs only on first primary init) |
| `.env.example` | Copy to `.env` and set strong passwords |

## Quick start

```bash
cd infra/postgres
cp .env.example .env
# Edit .env — use strong passwords for anything beyond local dev

docker compose build
docker compose up -d
```

Check replication (from host, with client tools installed):

```bash
# Primary — should show two streaming clients
docker exec -it postgres-primary psql -U fintech -d fintech -c "SELECT application_name, state, sync_state FROM pg_stat_replication;"
```

Default ports (override in `.env`):

| Role | Host port | Container |
|------|-----------|-----------|
| Write (primary) | 5432 | `postgres-primary` |
| Read replica 1 | 5433 | `postgres-read-1` |
| Read replica 2 | 5434 | `postgres-read-2` |

From **another container on the same Compose network**, use service names and **5432**:

- Primary: `postgres-primary:5432`
- Reads: `postgres-read-1:5432`, `postgres-read-2:5432`

## Connection strings (examples)

Replace `PASSWORD` with `POSTGRES_PASSWORD` from `.env`. Use TLS and secret management in production; below is suitable for local development.

### Write side (CQRS commands / transactions)

Single URL for inserts, updates, transfers, ledger postings:

```text
postgresql://fintech:PASSWORD@localhost:5432/fintech?sslmode=disable
```

### Read side (CQRS queries)

Point each query handler or connection pool at **one** replica, or rotate between them in your app / proxy (PgBouncer, HAProxy, cloud LB).

**Replica 1**

```text
postgresql://fintech:PASSWORD@localhost:5433/fintech?sslmode=disable
```

**Replica 2**

```text
postgresql://fintech:PASSWORD@localhost:5434/fintech?sslmode=disable
```

### NestJS / TypeORM-style dual DataSource (illustrative)

```typescript
// Command module — primary only
const writeUrl =
  'postgresql://fintech:PASSWORD@localhost:5432/fintech';

// Query module — pick one replica or round-robin in factory
const readUrls = [
  'postgresql://fintech:PASSWORD@localhost:5433/fintech',
  'postgresql://fintech:PASSWORD@localhost:5434/fintech',
];
```

Use **only the primary** for:

- Serializable / strict transactional workflows (e.g. double-spend checks, balance updates)
- DDL and migrations
- Session-level guarantees that must see the latest commit immediately after write

Use **replicas** for:

- Reports, balances displayed on dashboards, list/search endpoints where **small replication lag** is acceptable

### Replication lag and fintech expectations

Replicas apply the WAL **asynchronously**. After a successful commit on the primary, a read on a replica might not see that row for a short time. For “pay then show receipt” flows, either read from the primary for that user/session or use **read-after-write** routing (same connection as the write, or primary for N milliseconds after mutation).

## Resetting data

Volumes persist until removed. To recreate the cluster from scratch:

```bash
docker compose down -v
docker compose up -d
```

**Note:** `init-primary` scripts run only when the **primary** data directory is first initialized. If you change replication setup, use `down -v` or delete the named volumes.

## Security notes for production

- Enable **TLS** (`sslmode=verify-full` and server certificates).
- Do not expose Postgres ports publicly; use private networks or VPN.
- Rotate `POSTGRES_REPLICATION_PASSWORD` and restrict `pg_hba` to known replica IPs.
- Add **audit logging**, **backup/DR**, and **monitoring** (lag: `pg_stat_replication`, `replay_lag`).
- Consider **synchronous replication** or **RPO/RTO** targets if regulatory rules require stricter durability than async replicas provide.

## Troubleshooting

- **Replicas stuck “waiting for primary”:** ensure `postgres-primary` is healthy (`docker compose ps`) and `.env` passwords match.
- **`pg_basebackup` authentication failed:** check `POSTGRES_REPLICATION_PASSWORD` and that primary finished init (replication user exists).
- **Permission on init script:** `chmod +x init-primary/01-replication-user.sh`
