#!/usr/bin/env bash
# Replays every repo migration on a scratch Postgres database, then runs the
# SQL tests (licensing, and the quiz-attempt answer-key leak check). Needs a throwaway Postgres you can create
# databases in (never point it at a real project).
#
#   PSQL="psql -h localhost -p 5432 -U postgres" tests/sql/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL="${PSQL:-psql}"
DB=school_license_test

$PSQL -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -q -v ON_ERROR_STOP=1 -d $DB -f tests/sql/prelude.sql
for f in $(ls supabase/migrations/*.sql | sort); do
  echo "migrate $(basename "$f")"
  $PSQL -q -v ON_ERROR_STOP=1 -d $DB -f "$f" >/dev/null
done

# Runs one SQL test file and fails the whole script unless it finishes and
# prints its "PASSED" line. (psql with ON_ERROR_STOP stops at the first error,
# so a failing test never reaches that line.)
run_suite() {
  local db="$1" file="$2" out
  if ! out=$($PSQL -q -v ON_ERROR_STOP=1 -d "$db" -f "$file" 2>&1); then
    echo "$out" | grep -E "ERROR|FAILED" || echo "$out" | tail -20
    echo "FAILED: $file" >&2
    exit 1
  fi
  if ! echo "$out" | grep -E "PASSED"; then
    echo "FAILED: $file finished without a PASSED line" >&2
    exit 1
  fi
}

# license.test.sql builds its own minimal schema and drops public, so it
# runs in its own database.
$PSQL -q -d postgres -c "drop database if exists ${DB}_unit" -c "create database ${DB}_unit"
run_suite "${DB}_unit" tests/sql/license.test.sql

# Runs before the tests below: they grant table privileges to authenticated
# on this same database, which would hide a missing revoke here.
run_suite "$DB" tests/sql/payment-claims.test.sql

run_suite "$DB" tests/sql/license-features.test.sql

run_suite "$DB" tests/sql/quiz-attempt-leak.test.sql
