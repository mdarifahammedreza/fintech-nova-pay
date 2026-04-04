#!/bin/bash
set -euo pipefail

# Replication login for streaming replicas (read nodes).
repl_pass_sql=$(printf '%s' "$POSTGRES_REPLICATION_PASSWORD" | sed "s/'/''/g")
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE USER replicator WITH REPLICATION LOGIN ENCRYPTED PASSWORD '${repl_pass_sql}'"

{
  echo ''
  echo '# Streaming replication (Docker network)'
  echo 'host replication replicator 0.0.0.0/0 scram-sha-256'
} >> "${PGDATA}/pg_hba.conf"
