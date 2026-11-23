#!/usr/bin/env bash
set -euo pipefail

# Copies a remote PostgreSQL database (such as the current Neon showcase/testing DB)
# into a local Docker Postgres database inside the `embs-postgres` container.
#
# Usage:
#   SOURCE_DATABASE_URL="postgresql://...unpooled..." ./scripts/copy-remote-to-local.sh [local_db_name]
#
# Defaults:
#   SOURCE_DATABASE_URL -> reads DATABASE_URL_UNPOOLED or DATABASE_URL from .env.local
#   local_db_name       -> embs_portal (the local development/showcase DB)

LOCAL_DB_NAME="${1:-embs_portal}"
CONTAINER_NAME="${EMBS_PG_CONTAINER:-embs-postgres}"
PG_USER="${EMBS_PG_USER:-postgres}"

if ! [[ "$LOCAL_DB_NAME" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "Error: local database name must contain only letters, numbers, and underscores." >&2
  exit 1
fi

if [ -z "${SOURCE_DATABASE_URL:-}" ]; then
  if [ -f .env.local ]; then
    SOURCE_DATABASE_URL="$(grep -E '^DATABASE_URL_UNPOOLED=' .env.local | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
    if [ -z "$SOURCE_DATABASE_URL" ]; then
      SOURCE_DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
    fi
  fi
fi

if [ -z "${SOURCE_DATABASE_URL:-}" ]; then
  echo "Error: Set SOURCE_DATABASE_URL (prefer the unpooled direct Neon URL) or ensure .env.local exists." >&2
  exit 1
fi

if [[ "$SOURCE_DATABASE_URL" == *"-pooler."* ]]; then
  echo "Warning: SOURCE_DATABASE_URL uses a pooled endpoint (-pooler). Prefer DATABASE_URL_UNPOOLED for pg_dump." >&2
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Starting local Docker PostgreSQL container ($CONTAINER_NAME)..."
  docker compose up -d
  sleep 2
fi

echo "1/3 Dumping remote database via Docker pg_dump..."
TMP_DUMP="$(mktemp /tmp/embs-remote-dump-XXXXXX.sql)"
trap 'rm -f "$TMP_DUMP"' EXIT

docker exec -i -e PGURL="$SOURCE_DATABASE_URL" "$CONTAINER_NAME" \
  sh -c 'pg_dump --no-owner --no-privileges --clean --if-exists "$PGURL"' > "$TMP_DUMP"

echo "2/3 Ensuring local database '$LOCAL_DB_NAME' exists..."
docker exec "$CONTAINER_NAME" psql -U "$PG_USER" -tc \
  "SELECT 1 FROM pg_database WHERE datname = '$LOCAL_DB_NAME'" | grep -q 1 || \
  docker exec "$CONTAINER_NAME" psql -U "$PG_USER" -c "CREATE DATABASE \"$LOCAL_DB_NAME\";"

echo "3/3 Restoring dump into local database '$LOCAL_DB_NAME'..."
docker exec -i "$CONTAINER_NAME" psql -U "$PG_USER" -v ON_ERROR_STOP=1 -d "$LOCAL_DB_NAME" < "$TMP_DUMP" >/dev/null

echo ""
echo "Done. Your remote showcase/testing database has been copied to:"
echo "  postgresql://${PG_USER}:postgrespassword@localhost:5432/${LOCAL_DB_NAME}"
echo ""
echo "To run the app locally against this copied database, set DATABASE_URL in .env.local to that URL."
