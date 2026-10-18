-- READ ONLY. Catalog evidence for a separately authorized destination review.
-- No account rows, sleep payloads, settings changes or migration activation.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name, current_setting('server_version') AS postgres_version;
SELECT n.nspname AS schema_name,c.relname,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='public' AND c.relname IN('sleep_entries','sleep_entry_shares','baby_info','baby_members','account_links'))
 OR (n.nspname IN('consent_private','deletion_private','sleep_sync_private') AND c.relkind='r') ORDER BY 1,2;
SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default
 FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN('sleep_entries','sleep_entry_shares','baby_info','baby_members','account_links') ORDER BY 1,2,ordinal_position;
SELECT n.nspname AS schema_name,c.relname,t.tgname,pg_catalog.pg_get_triggerdef(t.oid,true) AS definition,
 p.oid::regprocedure::text AS function_signature,md5(pg_catalog.pg_get_functiondef(p.oid)) AS function_digest
 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
 WHERE NOT t.tgisinternal AND (c.relname IN('sleep_entries','sleep_entry_shares','baby_members','account_links')
 OR n.nspname IN('consent_private','deletion_private','sleep_sync_private')) ORDER BY 1,2,3;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
 WHERE tablename IN('sleep_entries','sleep_entry_shares','baby_info','baby_members','account_links') ORDER BY 1,2,3;
SELECT n.nspname AS schema_name,p.oid::regprocedure::text AS signature,p.prosecdef AS security_definer,p.proconfig,
 md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_digest,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND n.nspname IN('public','caretaker_private','consent_private','deletion_private','sleep_sync_private')
 AND (p.prosrc ILIKE '%sleep_entries%' OR n.nspname='sleep_sync_private'
 OR (n.nspname='consent_private' AND p.proname IN('family_allowed','row_allowed'))
 OR (n.nspname='deletion_private' AND p.proname='blocked')) ORDER BY 1,2;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants
 WHERE table_name IN('sleep_entries','sleep_entry_shares','settings','scopes','tickets','receipts') ORDER BY 1,2,3,4;
COMMIT;
