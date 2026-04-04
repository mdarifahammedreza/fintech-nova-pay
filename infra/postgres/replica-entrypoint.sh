#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "${PGDATA}/PG_VERSION" ]]; then
  echo "Replica: waiting for primary at ${PRIMARY_HOST}..."
  until pg_isready -h "${PRIMARY_HOST}" -p 5432; do
    sleep 2
  done

  echo "Replica: taking base backup from primary..."
  export PGPASSWORD="${POSTGRES_REPLICATION_PASSWORD}"
  pg_basebackup \
    -h "${PRIMARY_HOST}" \
    -p 5432 \
    -U replicator \
    -D "${PGDATA}" \
    -Fp \
    -Xs \
    -P \
    -R
  unset PGPASSWORD
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
