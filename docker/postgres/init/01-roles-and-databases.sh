#!/bin/bash
# Runs once, only when the postgres data directory is first initialized.
# Creates the least-privilege roles required by SPEC.md section 5.7:
#   - DB_OWNER_USER: owns the app databases, used only by drizzle-kit/migrations/seed (DDL rights)
#   - DB_APP_USER: used by the running Next.js server at runtime (DML only, no DDL, not superuser)
# POSTGRES_USER (superuser) is only ever used by this bootstrap script, never by the app.
set -e

: "${DB_OWNER_USER:?DB_OWNER_USER is required}"
: "${DB_OWNER_PASSWORD:?DB_OWNER_PASSWORD is required}"
: "${DB_APP_USER:?DB_APP_USER is required}"
: "${DB_APP_PASSWORD:?DB_APP_PASSWORD is required}"
: "${POSTGRES_TEST_DB:?POSTGRES_TEST_DB is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE ${DB_OWNER_USER} WITH LOGIN PASSWORD '${DB_OWNER_PASSWORD}';
  CREATE ROLE ${DB_APP_USER} WITH LOGIN PASSWORD '${DB_APP_PASSWORD}';
  ALTER DATABASE ${POSTGRES_DB} OWNER TO ${DB_OWNER_USER};
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  CREATE DATABASE ${POSTGRES_TEST_DB} OWNER ${DB_OWNER_USER};
EOSQL

for DB in "${POSTGRES_DB}" "${POSTGRES_TEST_DB}"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
    GRANT CONNECT ON DATABASE ${DB} TO ${DB_APP_USER};
    GRANT USAGE ON SCHEMA public TO ${DB_APP_USER};
    ALTER DEFAULT PRIVILEGES FOR ROLE ${DB_OWNER_USER} IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_APP_USER};
    ALTER DEFAULT PRIVILEGES FOR ROLE ${DB_OWNER_USER} IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO ${DB_APP_USER};
EOSQL
done
