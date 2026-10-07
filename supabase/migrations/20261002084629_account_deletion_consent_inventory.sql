-- Additive candidate only. Requires the eight deletion migrations and consent
-- records. No consent activation, operator approval, duration, cron or secrets.
BEGIN;
ALTER TABLE deletion_private.rules DROP CONSTRAINT rules_action_check;
ALTER TABLE deletion_private.rules ADD CONSTRAINT rules_action_check
 CHECK(action IN ('delete','detach','consent_revision') AND
  (action<>'consent_revision' OR
   (schema_name='consent_private' AND table_name='user_state' AND column_name='user_id')));
INSERT INTO deletion_private.rules VALUES
 ('consent_private','user_state','user_id','consent_revision'),
 ('consent_private','decisions','user_id','delete'),
 ('consent_private','operations','user_id','delete'),
 ('consent_private','events','user_id','delete');
ALTER TABLE deletion_private.requests ADD COLUMN consent_reset_revision bigint
 CHECK(consent_reset_revision IS NULL OR consent_reset_revision>0);
ALTER TABLE deletion_private.settings ADD COLUMN consent_handling_policy text
 NOT NULL DEFAULT 'unapproved' CHECK(consent_handling_policy IN
 ('unapproved','reset_reconsent_erase_evidence'));
ALTER TABLE deletion_private.settings ADD COLUMN consent_policy_approved_by text;
ALTER TABLE deletion_private.settings ADD COLUMN consent_policy_approved_at timestamptz;

-- Same per-identity lock as accept(); a statement snapshot taken before waiting
-- must not bypass a deletion accepted in the meantime. Non-RC callers fail closed.
CREATE FUNCTION consent_private.require_live_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'consent_requires_read_committed' USING ERRCODE='25000';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 IF deletion_private.blocked(p_user_id) THEN
  RAISE EXCEPTION 'account_deletion_pending' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
  RAISE EXCEPTION 'account_not_found' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION consent_private.require_live_user(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION consent_private.guard_deletion_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 -- Only the internal data-reset floor write may occur while erasing. Clients
 -- cannot call erase_rows or write these tables, and record_decision always
 -- checks the block before its first write or idempotent return.
 IF TG_TABLE_NAME='user_state' THEN
  IF auth.uid() IS NULL AND current_setting('deletion_private.erasing',true)='on'
   AND EXISTS(SELECT 1 FROM deletion_private.requests WHERE user_id=NEW.user_id
    AND scope='data' AND status<>'completed' AND consent_reset_revision=NEW.revision)
  THEN RETURN NEW; END IF;
 END IF;
 PERFORM consent_private.require_live_user(NEW.user_id);
 IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
  PERFORM consent_private.require_live_user(auth.uid());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION consent_private.guard_deletion_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['user_state','decisions','operations','events'] LOOP
  EXECUTE format('CREATE POLICY account_deletion_deny ON consent_private.%I AS RESTRICTIVE FOR ALL TO authenticated USING(NOT deletion_private.blocked(auth.uid())) WITH CHECK(NOT deletion_private.blocked(auth.uid()))',t);
  EXECUTE format('CREATE TRIGGER account_deletion_guard BEFORE INSERT OR UPDATE ON consent_private.%I FOR EACH ROW EXECUTE FUNCTION consent_private.guard_deletion_write()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION deletion_private.guard_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'consent_requires_read_committed' USING ERRCODE='25000';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF NOT public.account_deletion_readiness() THEN RAISE EXCEPTION 'deletion_inventory_not_approved'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.account_deletion_readiness() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM deletion_private.settings s WHERE s.singleton
  AND s.approved_fingerprint=deletion_private.fingerprint()
  AND length(trim(s.approved_by))>=3 AND s.approved_at IS NOT NULL AND s.approved_at<=now()
  AND s.receipt_retention_days>0
  AND (s.provider_handling_mode='supervised' OR (s.provider_handling_mode='verified_retention' AND s.backup_window_days>0))
  AND s.consent_handling_policy='reset_reconsent_erase_evidence'
  AND length(trim(s.consent_policy_approved_by))>=3
  AND s.consent_policy_approved_at IS NOT NULL AND s.consent_policy_approved_at<=now())
 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator'
  AND 'pgrst.db_pre_request=public.check_account_deletion_access'=ANY(rolconfig));
$$;
REVOKE ALL ON FUNCTION public.account_deletion_readiness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_readiness() TO service_role;

-- Reset removes evidence and current choices but preserves an increasing floor.
-- Store it once per request so an erase retry is idempotent. Greatest also
-- covers an inconsistent older user_state with newer operations/events.
CREATE FUNCTION deletion_private.erase_consent_state(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r deletion_private.requests; floor_revision bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT * INTO STRICT r FROM deletion_private.requests WHERE user_id=uid
  AND (scope='account' OR status<>'completed') FOR UPDATE;
 IF r.scope='account' THEN
  DELETE FROM consent_private.user_state WHERE user_id=uid;
  RETURN;
 END IF;
 floor_revision:=r.consent_reset_revision;
 IF floor_revision IS NULL THEN
  SELECT greatest(coalesce((SELECT revision FROM consent_private.user_state WHERE user_id=uid),0),
   coalesce((SELECT max(revision) FROM consent_private.operations WHERE user_id=uid),0),
   coalesce((SELECT max(revision) FROM consent_private.events WHERE user_id=uid),0))+1 INTO floor_revision;
  UPDATE deletion_private.requests SET consent_reset_revision=floor_revision WHERE id=r.id;
 END IF;
 INSERT INTO consent_private.user_state(user_id,revision) VALUES(uid,floor_revision)
  ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision;
END $$;
REVOKE ALL ON FUNCTION deletion_private.erase_consent_state(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Replaced bodies below retain the original manifest/FK erasure and verification
-- with the one explicit consent_revision exception. No other ownership rule changes.

CREATE OR REPLACE FUNCTION deletion_private.erase_rows(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rule record; remaining boolean; changed bigint; pass integer; progress bigint;
BEGIN
 PERFORM set_config('deletion_private.erasing','on',true);
 PERFORM deletion_private.erase_consent_state(uid);
 -- Repeat the explicit manifest to accommodate FK ordering; all passes share
 -- one transaction. An unresolved FK rolls back all SQL deletions.
 FOR rule IN SELECT x.* FROM deletion_private.rules x JOIN information_schema.columns c
 ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name WHERE action='detach' LOOP
  EXECUTE format('UPDATE %I.%I SET %I=NULL WHERE %I::text=$1',rule.schema_name,rule.table_name,rule.column_name,rule.column_name) USING uid::text;
 END LOOP;
 FOR pass IN 1..20 LOOP
  remaining := false; progress := 0;
  FOR rule IN SELECT x.* FROM deletion_private.rules x JOIN information_schema.columns c
   ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name WHERE action='delete'
   ORDER BY CASE WHEN x.table_name='profiles' THEN 2 WHEN x.table_name='baby_info' THEN 1 ELSE 0 END LOOP
   BEGIN
    EXECUTE format('DELETE FROM %I.%I WHERE %I::text=$1',rule.schema_name,rule.table_name,rule.column_name) USING uid::text;
    GET DIAGNOSTICS changed=ROW_COUNT; progress:=progress+changed;
   EXCEPTION WHEN foreign_key_violation THEN remaining:=true;
   END;
  END LOOP;
  IF NOT remaining THEN PERFORM set_config('deletion_private.erasing','off',true); RETURN; END IF;
  IF progress=0 THEN RAISE EXCEPTION 'unresolved_foreign_key'; END IF;
 END LOOP;
 RAISE EXCEPTION 'deletion_dependency_limit';
END $$;

CREATE OR REPLACE FUNCTION deletion_private.verify_rows(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rule record; found_rows boolean; r deletion_private.requests;
BEGIN
 SELECT * INTO STRICT r FROM deletion_private.requests WHERE user_id=uid AND (scope='account' OR status<>'completed');
 IF r.scope='data' THEN
  IF r.consent_reset_revision IS NULL OR NOT EXISTS(SELECT 1 FROM consent_private.user_state WHERE user_id=uid AND revision=r.consent_reset_revision) THEN RAISE EXCEPTION 'consent_reset_revision_missing'; END IF;
 ELSIF EXISTS(SELECT 1 FROM consent_private.user_state WHERE user_id=uid) THEN RAISE EXCEPTION 'residual_consent_revision'; END IF;
 FOR rule IN SELECT x.* FROM deletion_private.rules x JOIN information_schema.columns c
 ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name WHERE x.action<>'consent_revision' LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I::text=$1)',rule.schema_name,rule.table_name,rule.column_name) INTO found_rows USING uid::text;
  IF found_rows THEN RAISE EXCEPTION 'residual_database_rows'; END IF;
 END LOOP;
END $$;


CREATE OR REPLACE FUNCTION consent_private.record_decision(p_scope text, p_decision text,
  p_document_version text, p_locale text, p_operation_id uuid, p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); s consent_private.settings; current_revision bigint;
  previous consent_private.operations; at_time timestamptz;
BEGIN
  PERFORM consent_private.require_live_user(uid);
  IF p_scope IS NULL OR p_scope NOT IN ('health','ai') OR p_decision IS NULL OR p_decision NOT IN ('granted','declined','revoked')
    OR p_locale IS NULL OR p_locale NOT IN ('de','en','es') OR p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
    RAISE EXCEPTION 'invalid_consent_decision' USING ERRCODE='22023';
  END IF;
  SELECT * INTO s FROM consent_private.settings WHERE singleton;
  IF p_document_version IS DISTINCT FROM s.document_version THEN RAISE EXCEPTION 'consent_document_changed' USING ERRCODE='40001'; END IF;
  -- Withdrawal is always accepted, including during a paused rollout.
  IF NOT s.enabled AND p_decision <> 'revoked' THEN RAISE EXCEPTION 'consents_not_enabled' USING ERRCODE='55000'; END IF;
  INSERT INTO consent_private.user_state(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM consent_private.user_state WHERE user_id=uid FOR UPDATE;
  SELECT * INTO previous FROM consent_private.operations WHERE user_id=uid AND operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.scope IS DISTINCT FROM p_scope OR previous.decision IS DISTINCT FROM p_decision OR previous.locale IS DISTINCT FROM p_locale OR previous.document_version IS DISTINCT FROM p_document_version THEN
      RAISE EXCEPTION 'consent_operation_conflict' USING ERRCODE='22023';
    END IF;
    -- A retry never restores an old grant after a later withdrawal.
    RETURN consent_private.own_snapshot();
  END IF;
  IF current_revision <> p_expected_revision THEN RAISE EXCEPTION 'consent_revision_changed' USING ERRCODE='40001'; END IF;
  IF p_scope='ai' AND p_decision='granted' AND NOT consent_private.has_consent(uid,'health') THEN
    RAISE EXCEPTION 'health_consent_required' USING ERRCODE='42501';
  END IF;
  at_time := clock_timestamp();
  current_revision := current_revision+1;
  UPDATE consent_private.user_state SET revision=current_revision WHERE user_id=uid;
  INSERT INTO consent_private.operations(user_id,operation_id,scope,decision,document_version,locale,revision,created_at) VALUES(uid,p_operation_id,p_scope,p_decision,p_document_version,p_locale,current_revision,at_time);
  INSERT INTO consent_private.decisions(user_id,scope,decision,document_version,decided_at) VALUES(uid,p_scope,p_decision,p_document_version,at_time)
    ON CONFLICT(user_id,scope) DO UPDATE SET decision=excluded.decision,document_version=excluded.document_version,decided_at=excluded.decided_at;
  INSERT INTO consent_private.events(user_id,operation_id,scope,decision,document_version,locale,revision,decided_at,source) VALUES(uid,p_operation_id,p_scope,p_decision,p_document_version,p_locale,current_revision,at_time,'explicit_app_choice');
  IF p_scope='health' AND p_decision<>'granted' AND EXISTS(SELECT 1 FROM consent_private.decisions WHERE user_id=uid AND scope='ai' AND decision='granted') THEN
    UPDATE consent_private.decisions SET decision='revoked',document_version=p_document_version,decided_at=at_time WHERE user_id=uid AND scope='ai';
    INSERT INTO consent_private.events(user_id,operation_id,scope,decision,document_version,locale,revision,decided_at,source) VALUES(uid,p_operation_id,'ai','revoked',p_document_version,p_locale,current_revision,at_time,'health_withdrawal');
  END IF;
  RETURN consent_private.own_snapshot();
END $$;

CREATE OR REPLACE FUNCTION consent_private.own_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE health_allowed boolean; ai_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  IF deletion_private.blocked(auth.uid()) OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid()) THEN RAISE EXCEPTION 'account_deletion_pending' USING ERRCODE='42501'; END IF;
  IF to_regprocedure('consent_private.family_allowed(uuid,text)') IS NOT NULL THEN
    EXECUTE 'SELECT consent_private.family_allowed($1,''health''),consent_private.family_allowed($1,''ai'')'
      INTO health_allowed,ai_allowed USING auth.uid();
  ELSE
    health_allowed := consent_private.processing_allowed(auth.uid(),'health');
    ai_allowed := consent_private.processing_allowed(auth.uid(),'ai');
  END IF;
  RETURN consent_private.snapshot(auth.uid()) || jsonb_build_object('healthAllowed',health_allowed,'aiAllowed',ai_allowed);
END $$;

CREATE OR REPLACE FUNCTION consent_private.processing_allowed(p_user_id uuid,p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) AND NOT deletion_private.blocked(p_user_id) AND CASE WHEN NOT (enabled OR activated_at IS NOT NULL) THEN true ELSE
    p_user_id IS NOT NULL AND p_scope IN ('health','ai') AND consent_private.has_consent(p_user_id,'health')
    AND (p_scope='health' OR consent_private.has_consent(p_user_id,'ai')) END
  FROM consent_private.settings WHERE singleton
$$;

CREATE OR REPLACE FUNCTION deletion_private.fingerprint() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT md5(coalesce((SELECT string_agg(x,'|' ORDER BY x) FROM (
  SELECT n.nspname||'.'||c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull x
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','caretaker_private','storage','consent_private') AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT conname||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','caretaker_private','consent_private'))
  UNION ALL SELECT schema_name||'.'||table_name||'.'||column_name||':'||action FROM deletion_private.rules
  UNION ALL SELECT storage_origin FROM deletion_private.settings
  UNION ALL SELECT 'provider_handling_mode='||provider_handling_mode FROM deletion_private.settings
  UNION ALL SELECT 'consent_handling_policy='||consent_handling_policy FROM deletion_private.settings
  UNION ALL SELECT 'consent_reset_revision:v1:monotone_per_request:reset_clears_choices_and_evidence:account_erases_all'
  UNION ALL SELECT pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid IN (to_regprocedure('deletion_private.erase_consent_state(uuid)'),to_regprocedure('deletion_private.erase_rows(uuid)'),to_regprocedure('deletion_private.verify_rows(uuid)'),to_regprocedure('deletion_private.guard_acceptance()'),to_regprocedure('public.account_deletion_readiness()'))
  UNION ALL SELECT 'documents='||coalesce(string_agg(version||':'||md5(copy::text),'|' ORDER BY version),'') FROM consent_private.documents
  UNION ALL SELECT 'consent_catalog='||(jsonb_build_object(
 'schema',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='consent_private'),
 'tables',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'options',c.reloptions) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='consent_private' AND c.relkind IN ('r','p','v','m')),'[]'::jsonb),
 'columns',COALESCE((SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'ordinal',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='consent_private' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),
 'constraints',COALESCE((SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid,false),'validated',k.convalidated) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='consent_private'),'[]'::jsonb),
 'indexes',COALESCE((SELECT jsonb_agg(jsonb_build_object('table',c.relname,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready) ORDER BY c.relname,pg_get_indexdef(i.indexrelid)) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='consent_private'),'[]'::jsonb),
 'functions',COALESCE((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig,'security_definer',p.prosecdef) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND (n.nspname='consent_private' OR (n.nspname='public' AND p.proname IN ('get_data_consents','record_data_consent','check_data_processing_consent')))),'[]'::jsonb),
 'policies',COALESCE((SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',p.polname,'permissive',p.polpermissive,'command',p.polcmd,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY c.relname,p.polname) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='consent_private'),'[]'::jsonb),
 'triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='consent_private' AND NOT t.tgisinternal),'[]'::jsonb)
))::text
 ) q),'none'));
$$;

REVOKE ALL ON consent_private.user_state,consent_private.decisions,consent_private.operations,consent_private.events FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
