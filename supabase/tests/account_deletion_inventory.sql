-- Read-only live inventory. Store output in restricted operational evidence,
-- never export rows, mail addresses, secrets or health content to source control.
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls,
 jsonb_agg(jsonb_build_object('column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,'rule',r.action) ORDER BY a.attnum) AS columns
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN deletion_private.rules r ON r.schema_name=n.nspname AND r.table_name=c.relname AND r.column_name=a.attname
WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','caretaker_private') GROUP BY 1,2,3 ORDER BY 1,2;
SELECT conrelid::regclass AS source,confrelid::regclass AS target,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype='f' AND connamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','caretaker_private'));
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;
SELECT n.nspname,p.proname,p.prosecdef,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','caretaker_private') ORDER BY 1,2;
SELECT rolname,rolconfig FROM pg_roles WHERE rolname='authenticator';
SELECT deletion_private.fingerprint() AS current_fingerprint,approved_fingerprint,approved_at FROM deletion_private.settings;
-- Any unclassified column/reference is an explicit review item, not evidence
-- that a row is non-personal. Indirect FKs and JSON payloads require review too.
