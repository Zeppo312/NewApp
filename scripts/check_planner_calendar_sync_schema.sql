-- Read-only schema check for the Planner <-> Apple Calendar sync migration.
-- Run this manually in the Supabase SQL Editor of the real target database.
-- It does not create, alter, update, or delete anything.

-- 1) Database context
select
  current_database() as database_name,
  current_user as running_as,
  current_schema() as current_schema,
  now() as checked_at;

-- 2) Required existing objects for the migration
with required_objects as (
  select 'schema' as kind, 'auth' as object_name, to_regnamespace('auth') is not null as exists_ok
  union all select 'schema', 'public', to_regnamespace('public') is not null
  union all select 'table', 'auth.users', to_regclass('auth.users') is not null
  union all select 'table', 'public.planner_items', to_regclass('public.planner_items') is not null
  union all select 'table', 'public.planner_recurring_items', to_regclass('public.planner_recurring_items') is not null
  union all select 'table', 'public.planner_recurring_exceptions', to_regclass('public.planner_recurring_exceptions') is not null
  union all select 'function', 'auth.uid()', to_regprocedure('auth.uid()') is not null
  union all select 'function', 'public.set_updated_at()', to_regprocedure('public.set_updated_at()') is not null
  union all select 'function', 'gen_random_uuid()', to_regprocedure('gen_random_uuid()') is not null
)
select
  case when exists_ok then 'OK' else 'MISSING' end as status,
  kind,
  object_name
from required_objects
order by exists_ok, kind, object_name;

-- 3) Existing relevant Planner table columns
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'planner_items',
    'planner_recurring_items',
    'planner_recurring_exceptions',
    'planner_calendar_sync_settings',
    'planner_calendar_sync_links'
  )
order by table_name, ordinal_position;

-- 4) Minimum column compatibility required by the proposed sync migration/code
with required_columns(table_name, column_name, expected_udt) as (
  values
    ('planner_items', 'id', 'uuid'),
    ('planner_items', 'user_id', 'uuid'),
    ('planner_items', 'updated_at', 'timestamptz'),
    ('planner_recurring_items', 'id', 'uuid'),
    ('planner_recurring_items', 'user_id', 'uuid'),
    ('planner_recurring_items', 'updated_at', 'timestamptz'),
    ('planner_recurring_exceptions', 'id', 'uuid'),
    ('planner_recurring_exceptions', 'user_id', 'uuid'),
    ('planner_recurring_exceptions', 'updated_at', 'timestamptz')
),
actual as (
  select table_name, column_name, udt_name
  from information_schema.columns
  where table_schema = 'public'
)
select
  case
    when a.column_name is null then 'MISSING'
    when a.udt_name <> r.expected_udt then 'TYPE_MISMATCH'
    else 'OK'
  end as status,
  r.table_name,
  r.column_name,
  r.expected_udt,
  a.udt_name as actual_udt
from required_columns r
left join actual a
  on a.table_name = r.table_name
 and a.column_name = r.column_name
order by status desc, r.table_name, r.column_name;

-- 5) Existing constraints on relevant Planner/sync tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'planner_items',
    'planner_recurring_items',
    'planner_recurring_exceptions',
    'planner_calendar_sync_settings',
    'planner_calendar_sync_links'
  )
order by c.relname, con.conname;

-- 6) Existing indexes on relevant Planner/sync tables
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'planner_items',
    'planner_recurring_items',
    'planner_recurring_exceptions',
    'planner_calendar_sync_settings',
    'planner_calendar_sync_links'
  )
order by tablename, indexname;

-- 7) RLS state and policies on relevant Planner/sync tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'planner_items',
    'planner_recurring_items',
    'planner_recurring_exceptions',
    'planner_calendar_sync_settings',
    'planner_calendar_sync_links'
  )
  and c.relkind = 'r'
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'planner_items',
    'planner_recurring_items',
    'planner_recurring_exceptions',
    'planner_calendar_sync_settings',
    'planner_calendar_sync_links'
  )
order by tablename, policyname;

-- 8) Triggers on relevant Planner/sync tables
select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'planner_items',
    'planner_recurring_items',
    'planner_recurring_exceptions',
    'planner_calendar_sync_settings',
    'planner_calendar_sync_links'
  )
order by event_object_table, trigger_name, event_manipulation;

-- 9) Name conflicts that would affect the proposed migration.
-- If any row says CONFLICT, a planned index/trigger name already exists on an unexpected object.
with planned_index_names(name) as (
  values
    ('idx_planner_calendar_sync_settings_user_device'),
    ('idx_planner_calendar_sync_links_user_device'),
    ('idx_planner_calendar_sync_links_single'),
    ('idx_planner_calendar_sync_links_series'),
    ('idx_planner_calendar_sync_links_occurrence'),
    ('idx_planner_calendar_sync_links_apple_event')
),
planned_trigger_names(name, expected_table) as (
  values
    ('trg_planner_calendar_sync_settings_updated_at', 'planner_calendar_sync_settings'),
    ('trg_planner_calendar_sync_links_updated_at', 'planner_calendar_sync_links')
)
select
  case
    when cls.relname is null then 'OK_NOT_PRESENT'
    when ns.nspname = 'public'
      and cls.relkind = 'i'
      and (
        (pin.name = 'idx_planner_calendar_sync_settings_user_device' and tbl.relname = 'planner_calendar_sync_settings')
        or (pin.name like 'idx_planner_calendar_sync_links%' and tbl.relname = 'planner_calendar_sync_links')
      )
      then 'OK_EXPECTED'
    else 'CONFLICT'
  end as status,
  'index' as object_kind,
  pin.name as planned_name,
  ns.nspname as existing_schema,
  tbl.relname as existing_table,
  cls.relkind as existing_relkind
from planned_index_names pin
left join pg_class cls on cls.relname = pin.name
left join pg_namespace ns on ns.oid = cls.relnamespace
left join pg_index ix on ix.indexrelid = cls.oid
left join pg_class tbl on tbl.oid = ix.indrelid

union all

select
  case
    when trg.tgname is null then 'OK_NOT_PRESENT'
    when tbl.relname = ptn.expected_table then 'OK_EXPECTED'
    else 'CONFLICT'
  end as status,
  'trigger' as object_kind,
  ptn.name as planned_name,
  ns.nspname as existing_schema,
  tbl.relname as existing_table,
  null as existing_relkind
from planned_trigger_names ptn
left join pg_trigger trg on trg.tgname = ptn.name and not trg.tgisinternal
left join pg_class tbl on tbl.oid = trg.tgrelid
left join pg_namespace ns on ns.oid = tbl.relnamespace
order by status desc, object_kind, planned_name;

-- 10) Does the target DB already have the proposed sync tables?
select
  case when to_regclass('public.planner_calendar_sync_settings') is null then 'NOT_YET_CREATED' else 'ALREADY_EXISTS' end
    as planner_calendar_sync_settings,
  case when to_regclass('public.planner_calendar_sync_links') is null then 'NOT_YET_CREATED' else 'ALREADY_EXISTS' end
    as planner_calendar_sync_links;

-- 11) Grants for existing/proposed tables.
-- For tables that do not exist yet this returns no rows; after migration, authenticated needs access
-- in addition to RLS policies when using PostgREST/Supabase client access.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'planner_items',
    'planner_recurring_items',
    'planner_recurring_exceptions',
    'planner_calendar_sync_settings',
    'planner_calendar_sync_links'
  )
order by table_name, grantee, privilege_type;
