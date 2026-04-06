#!/bin/sh
set -e
cd /app

# Bind mount hides image node_modules; install when missing or incomplete.
if [ ! -d node_modules/@nestjs/core ]; then
  echo 'docker-entrypoint-dev: running npm ci...'
  npm ci
fi

exec "$@"
