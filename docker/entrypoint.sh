#!/bin/sh
set -eu
# Optional wait helpers for compose entrypoints (no secrets printed).
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL is set"
fi
if [ -n "${REDIS_URL:-}" ]; then
  echo "[entrypoint] REDIS_URL is set"
fi
exec "$@"
