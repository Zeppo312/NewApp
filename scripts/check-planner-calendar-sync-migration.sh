#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_FILE="${MIGRATION_FILE:-$ROOT_DIR/supabase/migrations/20260701000000_create_planner_calendar_sync.sql}"
DATABASE_URL_VALUE="${DATABASE_URL:-}"
DRY_RUN=1

usage() {
  cat <<'EOF'
Usage:
  DATABASE_URL="postgres://..." scripts/check-planner-calendar-sync-migration.sh
  scripts/check-planner-calendar-sync-migration.sh "postgres://..."

Options:
  --no-dry-run    Only inspect catalog prerequisites; do not execute the migration in a rolled-back transaction.
  --migration PATH
                  Use another migration file.

What it checks:
  - Required existing DB objects for the Planner calendar sync migration.
  - Whether the migration only adds the sync tables and does not mutate existing Planner tables.
  - Whether the migration can run inside BEGIN/ROLLBACK without persistent changes.
  - Whether the resulting sync tables, policies, triggers, indexes, and role grants exist.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --no-dry-run)
      DRY_RUN=0
      shift
      ;;
    --migration)
      MIGRATION_FILE="${2:-}"
      shift 2
      ;;
    *)
      if [[ -z "$DATABASE_URL_VALUE" ]]; then
        DATABASE_URL_VALUE="$1"
      else
        echo "Unexpected argument: $1" >&2
        usage >&2
        exit 2
      fi
      shift
      ;;
  esac
done

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "FAIL migration file not found: $MIGRATION_FILE" >&2
  exit 2
fi

echo "== Static migration check =="
echo "Migration: $MIGRATION_FILE"

static_fail=0

expect_contains() {
  local label="$1"
  local pattern="$2"
  if grep -Eq "$pattern" "$MIGRATION_FILE"; then
    echo "OK   $label"
  else
    echo "FAIL $label"
    static_fail=1
  fi
}

expect_absent() {
  local label="$1"
  local pattern="$2"
  if grep -Eiq "$pattern" "$MIGRATION_FILE"; then
    echo "FAIL $label"
    grep -Ein "$pattern" "$MIGRATION_FILE" || true
    static_fail=1
  else
    echo "OK   $label"
  fi
}

expect_contains "creates planner_calendar_sync_settings" "CREATE TABLE IF NOT EXISTS public\\.planner_calendar_sync_settings"
expect_contains "creates planner_calendar_sync_links" "CREATE TABLE IF NOT EXISTS public\\.planner_calendar_sync_links"
expect_contains "enables RLS on settings" "ALTER TABLE public\\.planner_calendar_sync_settings ENABLE ROW LEVEL SECURITY"
expect_contains "enables RLS on links" "ALTER TABLE public\\.planner_calendar_sync_links ENABLE ROW LEVEL SECURITY"
expect_contains "uses per-user auth.uid policies" "auth\\.uid\\(\\) = user_id"
expect_contains "uses set_updated_at triggers" "EXECUTE FUNCTION public\\.set_updated_at\\(\\)"

expect_absent "does not ALTER existing Planner tables" "^\\s*ALTER\\s+TABLE\\s+public\\.(planner_items|planner_days|planner_blocks|planner_recurring_items|planner_recurring_exceptions)\\b"
expect_absent "does not UPDATE existing Planner data" "^\\s*UPDATE\\s+public\\.(planner_items|planner_days|planner_blocks|planner_recurring_items|planner_recurring_exceptions)\\b"
expect_absent "does not DELETE/TRUNCATE existing Planner data" "^\\s*(DELETE\\s+FROM|TRUNCATE)\\s+public\\.(planner_items|planner_days|planner_blocks|planner_recurring_items|planner_recurring_exceptions)\\b"
expect_absent "does not DROP existing Planner tables" "^\\s*DROP\\s+TABLE\\s+.*public\\.(planner_items|planner_days|planner_blocks|planner_recurring_items|planner_recurring_exceptions)\\b"

if [[ "$static_fail" -ne 0 ]]; then
  echo "Static migration check failed." >&2
  exit 1
fi

if [[ -z "$DATABASE_URL_VALUE" ]]; then
  echo
  echo "No DATABASE_URL provided. Static migration check passed; DB catalog checks were skipped."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "FAIL psql is not installed or not on PATH." >&2
  exit 2
fi

echo
echo "== Database catalog pre-check =="
psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT
  current_database() AS database,
  current_user AS connected_as,
  version() AS postgres_version;

WITH checks(name, ok, detail) AS (
  VALUES
    ('schema public', to_regnamespace('public') IS NOT NULL, 'required for public Planner tables'),
    ('schema auth', to_regnamespace('auth') IS NOT NULL, 'required because migration references auth.users and auth.uid()'),
    ('table auth.users', to_regclass('auth.users') IS NOT NULL, 'required FK target'),
    ('function auth.uid()', to_regprocedure('auth.uid()') IS NOT NULL, 'required by RLS policies'),
    ('function gen_random_uuid()', to_regprocedure('gen_random_uuid()') IS NOT NULL, 'required UUID default'),
    ('function public.set_updated_at()', to_regprocedure('public.set_updated_at()') IS NOT NULL, 'required trigger function'),
    ('table public.planner_items', to_regclass('public.planner_items') IS NOT NULL, 'required FK target'),
    ('table public.planner_recurring_items', to_regclass('public.planner_recurring_items') IS NOT NULL, 'required FK target'),
    ('table public.planner_recurring_exceptions', to_regclass('public.planner_recurring_exceptions') IS NOT NULL, 'required FK target')
)
SELECT CASE WHEN ok THEN 'OK' ELSE 'FAIL' END AS status, name, detail
FROM checks
ORDER BY status DESC, name;

WITH required_columns(table_name, column_name, data_type) AS (
  VALUES
    ('planner_items', 'id', 'uuid'),
    ('planner_items', 'user_id', 'uuid'),
    ('planner_items', 'updated_at', 'timestamp with time zone'),
    ('planner_recurring_items', 'id', 'uuid'),
    ('planner_recurring_items', 'user_id', 'uuid'),
    ('planner_recurring_items', 'updated_at', 'timestamp with time zone'),
    ('planner_recurring_exceptions', 'id', 'uuid'),
    ('planner_recurring_exceptions', 'user_id', 'uuid'),
    ('planner_recurring_exceptions', 'updated_at', 'timestamp with time zone')
),
actual AS (
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
)
SELECT
  CASE WHEN a.column_name IS NULL THEN 'FAIL' ELSE 'OK' END AS status,
  r.table_name || '.' || r.column_name AS object,
  COALESCE(a.data_type, 'missing') AS actual_type,
  r.data_type AS expected_type
FROM required_columns r
LEFT JOIN actual a
  ON a.table_name = r.table_name
 AND a.column_name = r.column_name
ORDER BY status DESC, object;

DO $$
DECLARE
  failures text;
BEGIN
  WITH checks(name, ok) AS (
    VALUES
      ('schema auth', to_regnamespace('auth') IS NOT NULL),
      ('table auth.users', to_regclass('auth.users') IS NOT NULL),
      ('function auth.uid()', to_regprocedure('auth.uid()') IS NOT NULL),
      ('function gen_random_uuid()', to_regprocedure('gen_random_uuid()') IS NOT NULL),
      ('function public.set_updated_at()', to_regprocedure('public.set_updated_at()') IS NOT NULL),
      ('table public.planner_items', to_regclass('public.planner_items') IS NOT NULL),
      ('table public.planner_recurring_items', to_regclass('public.planner_recurring_items') IS NOT NULL),
      ('table public.planner_recurring_exceptions', to_regclass('public.planner_recurring_exceptions') IS NOT NULL)
  )
  SELECT string_agg(name, ', ') INTO failures FROM checks WHERE NOT ok;

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required DB objects: %', failures;
  END IF;
END $$;
SQL

if [[ "$DRY_RUN" -eq 0 ]]; then
  echo
  echo "Skipped transactional migration dry-run (--no-dry-run)."
  exit 0
fi

echo
echo "== Transactional migration dry-run =="
echo "The migration is executed inside BEGIN and rolled back. No persistent schema/data changes should remain."
psql "$DATABASE_URL_VALUE" -X -v ON_ERROR_STOP=1 -v migration_file="$MIGRATION_FILE" -P pager=off <<'SQL'
BEGIN;
\i :migration_file

WITH expected_tables(name, exists_ok) AS (
  VALUES
    ('public.planner_calendar_sync_settings', to_regclass('public.planner_calendar_sync_settings') IS NOT NULL),
    ('public.planner_calendar_sync_links', to_regclass('public.planner_calendar_sync_links') IS NOT NULL)
),
expected_policies(name, exists_ok) AS (
  VALUES
    ('planner_calendar_sync_settings_select_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_settings' AND policyname = 'planner_calendar_sync_settings_select_own')),
    ('planner_calendar_sync_settings_insert_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_settings' AND policyname = 'planner_calendar_sync_settings_insert_own')),
    ('planner_calendar_sync_settings_update_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_settings' AND policyname = 'planner_calendar_sync_settings_update_own')),
    ('planner_calendar_sync_settings_delete_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_settings' AND policyname = 'planner_calendar_sync_settings_delete_own')),
    ('planner_calendar_sync_links_select_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_links' AND policyname = 'planner_calendar_sync_links_select_own')),
    ('planner_calendar_sync_links_insert_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_links' AND policyname = 'planner_calendar_sync_links_insert_own')),
    ('planner_calendar_sync_links_update_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_links' AND policyname = 'planner_calendar_sync_links_update_own')),
    ('planner_calendar_sync_links_delete_own', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_links' AND policyname = 'planner_calendar_sync_links_delete_own'))
),
expected_triggers(name, exists_ok) AS (
  VALUES
    ('trg_planner_calendar_sync_settings_updated_at', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_planner_calendar_sync_settings_updated_at')),
    ('trg_planner_calendar_sync_links_updated_at', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_planner_calendar_sync_links_updated_at'))
),
expected_indexes(name, exists_ok) AS (
  VALUES
    ('idx_planner_calendar_sync_settings_user_device', to_regclass('public.idx_planner_calendar_sync_settings_user_device') IS NOT NULL),
    ('idx_planner_calendar_sync_links_user_device', to_regclass('public.idx_planner_calendar_sync_links_user_device') IS NOT NULL),
    ('idx_planner_calendar_sync_links_single', to_regclass('public.idx_planner_calendar_sync_links_single') IS NOT NULL),
    ('idx_planner_calendar_sync_links_series', to_regclass('public.idx_planner_calendar_sync_links_series') IS NOT NULL),
    ('idx_planner_calendar_sync_links_occurrence', to_regclass('public.idx_planner_calendar_sync_links_occurrence') IS NOT NULL),
    ('idx_planner_calendar_sync_links_apple_event', to_regclass('public.idx_planner_calendar_sync_links_apple_event') IS NOT NULL)
),
all_checks AS (
  SELECT 'table' AS kind, * FROM expected_tables
  UNION ALL SELECT 'policy', * FROM expected_policies
  UNION ALL SELECT 'trigger', * FROM expected_triggers
  UNION ALL SELECT 'index', * FROM expected_indexes
)
SELECT CASE WHEN exists_ok THEN 'OK' ELSE 'FAIL' END AS status, kind, name
FROM all_checks
ORDER BY status DESC, kind, name;

WITH role_check AS (
  SELECT to_regrole('authenticated') IS NOT NULL AS authenticated_exists
),
required_privs AS (
  SELECT *
  FROM (VALUES
    ('planner_calendar_sync_settings', 'SELECT'),
    ('planner_calendar_sync_settings', 'INSERT'),
    ('planner_calendar_sync_settings', 'UPDATE'),
    ('planner_calendar_sync_links', 'SELECT'),
    ('planner_calendar_sync_links', 'INSERT'),
    ('planner_calendar_sync_links', 'UPDATE'),
  ) AS v(table_name, privilege_type)
),
missing_privs AS (
  SELECT rp.table_name, rp.privilege_type
  FROM required_privs rp
  CROSS JOIN role_check rc
  WHERE rc.authenticated_exists
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public'
        AND g.table_name = rp.table_name
        AND g.grantee = 'authenticated'
        AND g.privilege_type = rp.privilege_type
    )
)
SELECT
  CASE
    WHEN NOT (SELECT authenticated_exists FROM role_check) THEN 'WARN'
    WHEN EXISTS (SELECT 1 FROM missing_privs) THEN 'FAIL'
    ELSE 'OK'
  END AS status,
  'authenticated role table grants' AS check_name,
  CASE
    WHEN NOT (SELECT authenticated_exists FROM role_check) THEN 'role authenticated does not exist; ignore this only if this DB is not Supabase/PostgREST-backed'
    WHEN EXISTS (SELECT 1 FROM missing_privs) THEN (SELECT string_agg(table_name || ':' || privilege_type, ', ' ORDER BY table_name, privilege_type) FROM missing_privs)
    ELSE 'SELECT/INSERT/UPDATE grants present through existing/default privileges'
  END AS detail;

DO $$
DECLARE
  failures text;
BEGIN
  WITH checks(name, ok) AS (
    VALUES
      ('table planner_calendar_sync_settings', to_regclass('public.planner_calendar_sync_settings') IS NOT NULL),
      ('table planner_calendar_sync_links', to_regclass('public.planner_calendar_sync_links') IS NOT NULL),
      ('policy settings select', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_settings' AND policyname = 'planner_calendar_sync_settings_select_own')),
      ('policy links select', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planner_calendar_sync_links' AND policyname = 'planner_calendar_sync_links_select_own')),
      ('trigger settings updated_at', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_planner_calendar_sync_settings_updated_at')),
      ('trigger links updated_at', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_planner_calendar_sync_links_updated_at'))
  )
  SELECT string_agg(name, ', ') INTO failures FROM checks WHERE NOT ok;

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'Migration dry-run did not produce expected objects: %', failures;
  END IF;
END $$;

ROLLBACK;
SQL

echo
echo "OK migration compatibility check completed; transactional dry-run was rolled back."
