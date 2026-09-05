-- Compact read-only check for Planner calendar sync migration compatibility.
-- Run the whole script in Supabase SQL Editor. Do not select only a subset of lines.
-- This script does not modify data or schema.

select *
from (
  -- Required schemas, tables, and functions
  select
    'required_object' as section,
    'schema auth' as item,
    case when to_regnamespace('auth') is not null then 'OK' else 'MISSING' end as status,
    null::text as detail
  union all
  select 'required_object', 'schema public',
    case when to_regnamespace('public') is not null then 'OK' else 'MISSING' end,
    null::text
  union all
  select 'required_object', 'table auth.users',
    case when to_regclass('auth.users') is not null then 'OK' else 'MISSING' end,
    null::text
  union all
  select 'required_object', 'table public.planner_items',
    case when to_regclass('public.planner_items') is not null then 'OK' else 'MISSING' end,
    null::text
  union all
  select 'required_object', 'table public.planner_recurring_items',
    case when to_regclass('public.planner_recurring_items') is not null then 'OK' else 'MISSING' end,
    null::text
  union all
  select 'required_object', 'table public.planner_recurring_exceptions',
    case when to_regclass('public.planner_recurring_exceptions') is not null then 'OK' else 'MISSING' end,
    null::text
  union all
  select 'required_object', 'function auth.uid()',
    case when to_regprocedure('auth.uid()') is not null then 'OK' else 'MISSING' end,
    null::text
  union all
  select 'required_object', 'function public.set_updated_at()',
    case when to_regprocedure('public.set_updated_at()') is not null then 'OK' else 'MISSING' end,
    null::text
  union all
  select 'required_object', 'function gen_random_uuid()',
    case when to_regprocedure('gen_random_uuid()') is not null then 'OK' else 'MISSING' end,
    null::text

  -- Proposed sync tables should usually not exist before migration.
  union all
  select 'target_state', 'public.planner_calendar_sync_settings',
    case when to_regclass('public.planner_calendar_sync_settings') is null then 'NOT_YET_CREATED' else 'ALREADY_EXISTS' end,
    null::text
  union all
  select 'target_state', 'public.planner_calendar_sync_links',
    case when to_regclass('public.planner_calendar_sync_links') is null then 'NOT_YET_CREATED' else 'ALREADY_EXISTS' end,
    null::text

  -- Required column compatibility
  union all
  select
    'required_column',
    rc.table_name || '.' || rc.column_name,
    case
      when c.column_name is null then 'MISSING'
      when c.udt_name <> rc.expected_udt then 'TYPE_MISMATCH'
      else 'OK'
    end,
    'expected=' || rc.expected_udt || ', actual=' || coalesce(c.udt_name, 'missing')
  from (
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
  ) as rc(table_name, column_name, expected_udt)
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = rc.table_name
   and c.column_name = rc.column_name

  -- RLS state on existing relevant tables
  union all
  select
    'rls',
    cls.relname,
    case when cls.relrowsecurity then 'OK_ENABLED' else 'WARN_DISABLED' end,
    'force_rls=' || cls.relforcerowsecurity::text
  from pg_class cls
  join pg_namespace ns on ns.oid = cls.relnamespace
  where ns.nspname = 'public'
    and cls.relkind = 'r'
    and cls.relname in (
      'planner_items',
      'planner_recurring_items',
      'planner_recurring_exceptions',
      'planner_calendar_sync_settings',
      'planner_calendar_sync_links'
    )

  -- Existing policy count on each relevant table
  union all
  select
    'policy_count',
    p.schemaname || '.' || p.tablename,
    count(*)::text,
    string_agg(p.policyname, ', ' order by p.policyname)
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in (
      'planner_items',
      'planner_recurring_items',
      'planner_recurring_exceptions',
      'planner_calendar_sync_settings',
      'planner_calendar_sync_links'
    )
  group by p.schemaname, p.tablename

  -- Planned index-name conflicts
  union all
  select
    'planned_name_conflict',
    planned.name,
    case
      when existing.oid is null then 'OK_NOT_PRESENT'
      when planned.expected_table = tbl.relname then 'OK_EXPECTED'
      else 'CONFLICT'
    end,
    coalesce(ns.nspname || '.' || tbl.relname, 'no existing object')
  from (
    values
      ('idx_planner_calendar_sync_settings_user_device', 'planner_calendar_sync_settings'),
      ('idx_planner_calendar_sync_links_user_device', 'planner_calendar_sync_links'),
      ('idx_planner_calendar_sync_links_single', 'planner_calendar_sync_links'),
      ('idx_planner_calendar_sync_links_series', 'planner_calendar_sync_links'),
      ('idx_planner_calendar_sync_links_occurrence', 'planner_calendar_sync_links'),
      ('idx_planner_calendar_sync_links_apple_event', 'planner_calendar_sync_links')
  ) as planned(name, expected_table)
  left join pg_class existing on existing.relname = planned.name
  left join pg_index ix on ix.indexrelid = existing.oid
  left join pg_class tbl on tbl.oid = ix.indrelid
  left join pg_namespace ns on ns.oid = tbl.relnamespace
) checks
order by
  case
    when status in ('MISSING', 'TYPE_MISMATCH', 'CONFLICT') then 0
    when status like 'WARN%' then 1
    else 2
  end,
  section,
  item;

-- Optional detail view: current relevant table columns.
-- Run separately if you want full column details.
select
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
