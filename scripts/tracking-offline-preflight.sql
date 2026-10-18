-- Catalog evidence for tracking_offline_outbox, before or after deployment.
-- Run against the explicitly verified destination. No family/account payloads.
BEGIN TRANSACTION READ ONLY;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '15s';

WITH targets(schema_name, table_name) AS (VALUES
  ('public','baby_info'), ('public','baby_members'), ('public','account_links'),
  ('public','sleep_entry_shares'), ('public','custom_activity_types'),
  ('public','baby_care_entries'), ('public','sleep_entries'),
  ('public','inventory_items'), ('public','inventory_transactions'),
  ('public','baby_daily_habit_checks'), ('public','tracking_sync_receipts'),
  ('consent_private','decisions'), ('deletion_private','rules')
), relations AS (
  SELECT t.*, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
    pg_catalog.pg_get_userbyid(c.relowner) AS owner
  FROM targets t
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=t.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=t.table_name
), triggers AS (
  SELECT r.schema_name,r.table_name,t.tgname AS name,t.tgenabled AS enabled,
    pg_catalog.pg_get_triggerdef(t.oid,true) AS definition,
    p.oid::regprocedure::text AS function_signature,
    pg_catalog.pg_get_functiondef(p.oid) AS function_definition
  FROM relations r JOIN pg_catalog.pg_trigger t ON t.tgrelid=r.oid
  JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal
), functions AS (
  SELECT n.nspname AS schema_name,p.proname AS name,
    p.oid::regprocedure::text AS signature,p.prosecdef AS security_definer,
    p.proconfig,pg_catalog.pg_get_functiondef(p.oid) AS definition,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prokind='f' AND (
    (n.nspname='consent_private' AND p.proname IN ('family_allowed','row_allowed'))
    OR (n.nspname='public' AND p.proname IN ('tracking_sync_operation','clear_tracking_receipts_on_withdrawal'))
    OR (n.nspname='deletion_private' AND p.proname IN ('preflight','blocked'))
    OR (n.nspname='public' AND p.proname LIKE 'account_deletion%readiness%')
  )
)
SELECT jsonb_build_object(
  'database',current_database(), 'role',current_user,
  'serverVersion',current_setting('server_version'),
  'trackingRpc',to_regprocedure('public.tracking_sync_operation(uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz,text)')::text,
  'sleepPackageS',to_regnamespace('sleep_sync_private')::text,
  'relations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY schema_name,table_name) FROM relations r),
  'columns',(SELECT jsonb_agg(jsonb_build_object(
      'schema',r.schema_name,'table',r.table_name,'name',a.attname,
      'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
      'identity',a.attidentity,'generated',a.attgenerated
    ) ORDER BY r.schema_name,r.table_name,a.attnum)
    FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=r.oid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_object(
      'schema',r.schema_name,'table',r.table_name,'name',k.conname,
      'definition',pg_catalog.pg_get_constraintdef(k.oid,true)
    ) ORDER BY r.schema_name,r.table_name,k.conname)
    FROM relations r JOIN pg_catalog.pg_constraint k ON k.conrelid=r.oid),
  'indexes',(SELECT jsonb_agg(jsonb_build_object(
      'schema',r.schema_name,'table',r.table_name,'definition',pg_catalog.pg_get_indexdef(i.indexrelid),
      'valid',i.indisvalid,'ready',i.indisready
    ) ORDER BY r.schema_name,r.table_name,i.indexrelid)
    FROM relations r JOIN pg_catalog.pg_index i ON i.indrelid=r.oid),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname)
    FROM pg_catalog.pg_policies p JOIN targets t ON t.schema_name=p.schemaname AND t.table_name=p.tablename),
  'grants',(SELECT jsonb_agg(jsonb_build_object(
      'schema',r.schema_name,'table',r.table_name,
      'authenticatedSelect',has_table_privilege('authenticated',r.oid,'SELECT'),
      'authenticatedInsert',has_table_privilege('authenticated',r.oid,'INSERT'),
      'authenticatedUpdate',has_table_privilege('authenticated',r.oid,'UPDATE'),
      'authenticatedDelete',has_table_privilege('authenticated',r.oid,'DELETE'),
      'anonSelect',has_table_privilege('anon',r.oid,'SELECT')
    ) ORDER BY r.schema_name,r.table_name) FROM relations r WHERE r.oid IS NOT NULL),
  'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name,name) FROM triggers t),
  'functions',(SELECT jsonb_agg(to_jsonb(f) ORDER BY schema_name,signature) FROM functions f),
  'realtime',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.pubname,p.schemaname,p.tablename)
    FROM pg_catalog.pg_publication_tables p JOIN targets t ON t.schema_name=p.schemaname AND t.table_name=p.tablename),
  'schemas',(SELECT jsonb_agg(jsonb_build_object(
      'name',n.nspname,'authenticatedUsage',has_schema_privilege('authenticated',n.oid,'USAGE')
    ) ORDER BY n.nspname) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','consent_private','deletion_private'))
) AS evidence;
ROLLBACK;
