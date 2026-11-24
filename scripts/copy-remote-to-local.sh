#!/usr/bin/env bash
set -euo pipefail

# Copies a remote PostgreSQL database (such as the current Neon showcase/testing DB)
# into a local Docker Postgres database inside the `embs-postgres` container.
# Automatically matches the remote Postgres major version for `pg_dump` (e.g. PG 18 on Neon)
# and strips newer-version-only dump directives when restoring into a PG 16 local container.
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

LOCAL_MAJOR="$(docker exec "$CONTAINER_NAME" pg_dump --version | sed -E 's/.* ([0-9]+)\..*/\1/')"
REMOTE_VERSION_NUM="$(docker exec -e PGURL="$SOURCE_DATABASE_URL" "$CONTAINER_NAME" sh -c 'psql "$PGURL" -tAc "SHOW server_version_num;"' | tr -d '[:space:]')"
REMOTE_MAJOR="$(( REMOTE_VERSION_NUM / 10000 ))"

echo "1/3 Dumping remote PostgreSQL ${REMOTE_MAJOR} database..."
TMP_DUMP="$(mktemp /tmp/embs-remote-dump-XXXXXX.sql)"
trap 'rm -f "$TMP_DUMP"' EXIT

if [ "$REMOTE_MAJOR" -gt "$LOCAL_MAJOR" ]; then
  echo "    Using postgres:${REMOTE_MAJOR}-alpine client to match remote server version ${REMOTE_MAJOR}..."
  docker run --rm -e PGURL="$SOURCE_DATABASE_URL" "postgres:${REMOTE_MAJOR}-alpine" \
    sh -c 'pg_dump --no-owner --no-privileges --clean --if-exists "$PGURL"' > "$TMP_DUMP"
else
  docker exec -i -e PGURL="$SOURCE_DATABASE_URL" "$CONTAINER_NAME" \
    sh -c 'pg_dump --no-owner --no-privileges --clean --if-exists "$PGURL"' > "$TMP_DUMP"
fi

# Strip directives emitted by newer pg_dump versions (PG 17/18) that older local psql/PG 16 rejects.
if [ "$REMOTE_MAJOR" -gt "$LOCAL_MAJOR" ]; then
  sed -i \
    -e '/^SET transaction_timeout = /d' \
    -e '/^\\restrict /d' \
    -e '/^\\unrestrict /d' \
    "$TMP_DUMP"
fi

echo "2/3 Recreating local database '$LOCAL_DB_NAME'..."
docker exec "$CONTAINER_NAME" psql -U "$PG_USER" -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${LOCAL_DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
docker exec "$CONTAINER_NAME" psql -U "$PG_USER" -c "DROP DATABASE IF EXISTS \"${LOCAL_DB_NAME}\";" >/dev/null
docker exec "$CONTAINER_NAME" psql -U "$PG_USER" -c "CREATE DATABASE \"${LOCAL_DB_NAME}\";" >/dev/null

echo "3/3 Restoring dump into local database '$LOCAL_DB_NAME'..."
docker exec -i "$CONTAINER_NAME" psql -U "$PG_USER" -v ON_ERROR_STOP=1 -d "$LOCAL_DB_NAME" < "$TMP_DUMP" >/dev/null

echo ""
echo "Done. Your remote showcase/testing database has been copied to:"
echo "  postgresql://${PG_USER}:postgrespassword@localhost:5432/${LOCAL_DB_NAME}"
echo ""
echo "To run the app locally against this copied database:"
echo "  DATABASE_URL=\"postgresql://${PG_USER}:postgrespassword@localhost:5432/${LOCAL_DB_NAME}\" pnpm dev"
