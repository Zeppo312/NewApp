-- Explicit supervised provider handling does not invent an unknown copy window.
-- Default remains unapproved. No approval, duration, secret or scheduler is set.
-- Outside-database restore register and per-case provider evidence are required
-- operationally; NULL backup_window_days must never purge durable receipts.
BEGIN;
ALTER TABLE deletion_private.settings ADD COLUMN provider_handling_mode text
 NOT NULL DEFAULT 'unapproved'
 CHECK(provider_handling_mode IN ('unapproved','supervised','verified_retention'));

CREATE OR REPLACE FUNCTION deletion_private.fingerprint() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT md5(coalesce((SELECT string_agg(x,'|' ORDER BY x) FROM (
  SELECT n.nspname||'.'||c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull x
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','caretaker_private','storage') AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT conname||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','caretaker_private'))
  UNION ALL SELECT schema_name||'.'||table_name||'.'||column_name||':'||action FROM deletion_private.rules
  UNION ALL SELECT storage_origin FROM deletion_private.settings
  UNION ALL SELECT 'provider_handling_mode='||provider_handling_mode FROM deletion_private.settings
 ) q),'none'));
$$;
CREATE OR REPLACE FUNCTION public.account_deletion_readiness() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1 FROM deletion_private.settings s
  WHERE s.singleton AND s.approved_fingerprint = deletion_private.fingerprint()
    AND length(trim(s.approved_by)) >= 3
    AND s.approved_at IS NOT NULL AND s.approved_at <= now()
    AND s.receipt_retention_days > 0
    AND (s.provider_handling_mode='supervised'
      OR (s.provider_handling_mode='verified_retention' AND s.backup_window_days>0))
 ) AND EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles
  WHERE rolname = 'authenticator'
    AND 'pgrst.db_pre_request=public.check_account_deletion_access'=ANY(rolconfig)
 );
$$;
REVOKE ALL ON FUNCTION public.account_deletion_readiness() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_readiness() TO service_role;

CREATE OR REPLACE FUNCTION deletion_private.accept(uid uuid, requested_scope text, request_source text, identity_evidence text DEFAULT NULL, verified_by text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r deletion_private.requests; approved text;
BEGIN
 IF requested_scope NOT IN ('account','data') OR request_source NOT IN ('app','web','support') THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT * INTO r FROM deletion_private.requests WHERE user_id=uid AND (scope='account' OR status<>'completed') ORDER BY created_at LIMIT 1;
 IF FOUND THEN
  IF r.scope<>requested_scope THEN RAISE EXCEPTION 'active_deletion_scope_conflict'; END IF;
  RETURN jsonb_build_object('requestId',r.id,'status',r.status,'scope',r.scope); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator' AND 'pgrst.db_pre_request=public.check_account_deletion_access'=ANY(rolconfig)) THEN RAISE EXCEPTION 'deletion_access_guard_not_installed'; END IF;
 SELECT approved_fingerprint INTO approved FROM deletion_private.settings WHERE singleton;
 IF NOT EXISTS(SELECT 1 FROM deletion_private.settings WHERE singleton AND receipt_retention_days>0
  AND (provider_handling_mode='supervised' OR (provider_handling_mode='verified_retention' AND backup_window_days>0))) THEN
  RAISE EXCEPTION 'deletion_retention_not_configured';
 END IF;
 IF approved IS NULL OR approved <> deletion_private.fingerprint()
  OR NOT EXISTS(SELECT 1 FROM deletion_private.settings WHERE singleton
   AND length(trim(approved_by))>=3 AND approved_at IS NOT NULL AND approved_at<=now()) THEN
  RAISE EXCEPTION 'deletion_inventory_not_approved';
 END IF;
 IF request_source='support' THEN
  IF length(trim(coalesce(identity_evidence,''))) NOT BETWEEN 8 AND 2000 OR length(trim(coalesce(verified_by,''))) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'identity_verification_evidence_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'account_not_found'; END IF;
 ELSIF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND last_sign_in_at > now()-interval '10 minutes') THEN
  RAISE EXCEPTION 'recent_authentication_required' USING ERRCODE='42501';
 END IF;
 INSERT INTO deletion_private.requests(user_id,scope,source) VALUES(uid,requested_scope,request_source) RETURNING * INTO r;
 IF request_source='support' THEN
  INSERT INTO deletion_private.events(request_id,action,operator,evidence) VALUES(r.id,'support_identity_verified',verified_by,identity_evidence);
 END IF;
 INSERT INTO deletion_private.provider_tasks(request_id,provider)
 SELECT r.id,p FROM unnest(ARRAY['revenuecat','apple','openai','sentry','push','support_mail','shop','external_logs','convex_legacy','backups','shared_content']) p;
 IF requested_scope='data' THEN
  UPDATE deletion_private.provider_tasks SET status='not_applicable',evidence='Data reset retains authentication and subscription management; no provider account deletion requested.',resolved_by='scope-policy' WHERE request_id=r.id AND provider IN ('apple','revenuecat');
 END IF;
 UPDATE deletion_private.provider_tasks SET locator=(SELECT jsonb_build_object('email',email,'identities',(SELECT jsonb_agg(jsonb_build_object('provider',i.provider,'provider_id',i.provider_id)) FROM auth.identities i WHERE i.user_id=uid)) FROM auth.users WHERE id=uid) WHERE request_id=r.id AND provider IN ('apple','support_mail','shop','shared_content');
 DELETE FROM auth.sessions WHERE user_id=uid;
 RETURN jsonb_build_object('requestId',r.id,'status',r.status,'scope',r.scope);
END $$;

-- Keep the SQL table aliases distinct from the PL/pgSQL request variable r.
-- CREATE OR REPLACE preserves the existing service-only function grants.
CREATE OR REPLACE FUNCTION deletion_private.worker(action text, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r deletion_private.requests; result jsonb; uid uuid; object_count integer;
BEGIN
 IF action='list' THEN
  SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (SELECT req.id,req.scope,req.status,req.phase,req.created_at,req.error_code,(SELECT jsonb_agg(jsonb_build_object('provider',t.provider,'status',t.status,'due_at',t.due_at)) FROM deletion_private.provider_tasks t WHERE t.request_id=req.id) AS providers FROM deletion_private.requests req WHERE req.status<>'completed' ORDER BY req.created_at LIMIT 100) x;
  RETURN result;
 END IF;
 IF action='purge_receipts' THEN
  DELETE FROM deletion_private.requests req USING deletion_private.settings s WHERE req.status='completed' AND req.completed_at < now()-make_interval(days=>greatest(s.receipt_retention_days,s.backup_window_days)) AND s.receipt_retention_days IS NOT NULL AND s.backup_window_days IS NOT NULL;
  RETURN '{}'::jsonb;
 END IF;
 IF action='accept' THEN RETURN deletion_private.accept((payload->>'userId')::uuid,payload->>'scope',payload->>'source',payload->>'evidence',payload->>'operator'); END IF;
 IF action='blocked' THEN RETURN to_jsonb(deletion_private.blocked((payload->>'userId')::uuid)); END IF;
 IF action='claim' THEN
  SELECT * INTO r FROM deletion_private.requests WHERE status IN ('queued','processing','retry_wait','retention_pending')
   AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
  UPDATE deletion_private.requests SET lease=gen_random_uuid(),lease_until=now()+interval '3 minutes',status='processing',attempts=attempts+1,updated_at=now()
   WHERE id=r.id RETURNING * INTO r;
  RETURN to_jsonb(r);
 END IF;
 SELECT * INTO r FROM deletion_private.requests WHERE id=(payload->>'requestId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
 IF action='resolve_provider' THEN
  IF r.status='completed' OR (payload->>'status') NOT IN ('completed','not_applicable','retention_pending') THEN RAISE EXCEPTION 'invalid_provider_resolution'; END IF;
  IF length(trim(coalesce(payload->>'evidence',''))) NOT BETWEEN 8 AND 2000 OR length(trim(coalesce(payload->>'operator',''))) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'evidence_required'; END IF;
  UPDATE deletion_private.provider_tasks SET status=payload->>'status',evidence=payload->>'evidence',locator=CASE WHEN payload->>'status' IN ('completed','not_applicable') THEN NULL ELSE locator END,resolved_by=payload->>'operator',due_at=(payload->>'dueAt')::timestamptz,updated_at=now()
   WHERE request_id=r.id AND provider=payload->>'provider';
  IF NOT FOUND THEN RAISE EXCEPTION 'provider_not_found'; END IF;
  INSERT INTO deletion_private.events(request_id,action,operator,evidence) VALUES(r.id,'provider:'||(payload->>'provider')||':'||(payload->>'status'),payload->>'operator',payload->>'evidence');
  UPDATE deletion_private.requests SET status='queued',next_attempt_at=now(),error_code=NULL WHERE id=r.id AND lease_until IS NULL;
  RETURN '{}'::jsonb;
 END IF;
 IF action='resume' THEN
  IF r.status='completed' THEN RAISE EXCEPTION 'request_already_completed'; END IF;
  IF r.lease_until>now() THEN RAISE EXCEPTION 'lease_active'; END IF;
  IF length(trim(coalesce(payload->>'evidence',''))) NOT BETWEEN 8 AND 2000 OR length(trim(coalesce(payload->>'operator',''))) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'evidence_required'; END IF;
  INSERT INTO deletion_private.events(request_id,action,operator,evidence) VALUES(r.id,'resume',payload->>'operator',payload->>'evidence');
  UPDATE deletion_private.requests SET status='queued',next_attempt_at=now(),error_code=NULL WHERE id=r.id AND (lease_until IS NULL OR lease_until<now());
  RETURN '{}'::jsonb;
 END IF;
 IF r.lease IS NULL OR r.lease_until IS NULL OR r.lease IS DISTINCT FROM (payload->>'lease')::uuid OR r.lease_until<=now() THEN RAISE EXCEPTION 'lease_lost'; END IF;
 uid:=r.user_id;
 IF action NOT IN ('fail','release','providers') AND (SELECT approved_fingerprint FROM deletion_private.settings WHERE singleton) IS DISTINCT FROM deletion_private.fingerprint() THEN RAISE EXCEPTION 'deletion_inventory_not_approved'; END IF;
 IF action='inventory' THEN
  IF r.phase<>'inventory' THEN RAISE EXCEPTION 'wrong_phase'; END IF;
  PERFORM deletion_private.preflight(uid);
  PERFORM deletion_private.collect_objects(r.id,uid);
  UPDATE deletion_private.requests SET phase='storage' WHERE id=r.id;
 ELSIF action='objects' THEN
  IF r.phase<>'storage' THEN RAISE EXCEPTION 'wrong_phase'; END IF;
  SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (SELECT bucket,path FROM deletion_private.objects WHERE request_id=r.id AND removed_at IS NULL ORDER BY bucket,path LIMIT 10) x;
  RETURN result;
 ELSIF action='objects_removed' THEN
  IF r.phase<>'storage' THEN RAISE EXCEPTION 'wrong_phase'; END IF;
  -- Mark only after the API has removed the binary and the worker verified it.
  UPDATE deletion_private.objects o SET removed_at=now() WHERE request_id=r.id AND EXISTS(
   SELECT 1 FROM jsonb_array_elements(payload->'objects') x WHERE x->>'bucket'=o.bucket AND x->>'path'=o.path);
 ELSIF action='storage_done' THEN
  IF r.phase<>'storage' THEN RAISE EXCEPTION 'wrong_phase'; END IF;
  PERFORM deletion_private.collect_objects(r.id,uid);
  IF EXISTS(SELECT 1 FROM deletion_private.objects WHERE request_id=r.id AND removed_at IS NULL) THEN RAISE EXCEPTION 'storage_pending'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects o JOIN deletion_private.objects d ON d.bucket=o.bucket_id AND d.path=o.name WHERE d.request_id=r.id) THEN RAISE EXCEPTION 'residual_storage_objects'; END IF;
  UPDATE deletion_private.requests SET phase='database' WHERE id=r.id;
 ELSIF action='database' THEN
  IF r.phase<>'database' THEN RAISE EXCEPTION 'wrong_phase'; END IF;
  PERFORM deletion_private.preflight(uid);
  PERFORM deletion_private.erase_rows(uid);
  PERFORM deletion_private.verify_rows(uid);
  UPDATE deletion_private.requests SET phase='auth' WHERE id=r.id;
 ELSIF action='auth_done' THEN
  IF r.phase<>'auth' THEN RAISE EXCEPTION 'wrong_phase'; END IF;
  IF r.scope='account' AND EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'auth_still_exists'; END IF;
  UPDATE deletion_private.requests SET phase='providers' WHERE id=r.id;
 ELSIF action='providers' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO result FROM deletion_private.provider_tasks t WHERE request_id=r.id;
  RETURN result;
 ELSIF action='verify' THEN
  IF r.phase NOT IN ('providers','verify') THEN RAISE EXCEPTION 'wrong_phase'; END IF;
  PERFORM deletion_private.verify_rows(uid);
  IF EXISTS(SELECT 1 FROM storage.objects o JOIN deletion_private.objects d ON d.bucket=o.bucket_id AND d.path=o.name WHERE d.request_id=r.id) THEN RAISE EXCEPTION 'residual_storage_objects'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects o WHERE coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')=uid::text) THEN RAISE EXCEPTION 'late_storage_objects'; END IF;
  -- Absence of a mandatory row is not evidence of non-applicability.
  -- Both scopes retain all base items; data reset resolves Apple/RC as N/A.
  IF EXISTS(SELECT 1 FROM unnest(ARRAY[
    'revenuecat','apple','openai','sentry','push','support_mail','shop',
    'external_logs','convex_legacy','backups','shared_content','storage_cdn'
   ]) AS required(provider) WHERE NOT EXISTS(
    SELECT 1 FROM deletion_private.provider_tasks t
    WHERE t.request_id=r.id AND t.provider=required.provider)) THEN
   UPDATE deletion_private.requests SET status='needs_attention',error_code='provider_inventory_incomplete',lease=NULL,lease_until=NULL WHERE id=r.id;
  ELSIF EXISTS(SELECT 1 FROM deletion_private.provider_tasks WHERE request_id=r.id AND status='pending') THEN
   UPDATE deletion_private.requests SET status='needs_attention',error_code='provider_evidence_required',lease=NULL,lease_until=NULL WHERE id=r.id;
  ELSIF EXISTS(SELECT 1 FROM deletion_private.provider_tasks WHERE request_id=r.id AND status='retention_pending') THEN
   UPDATE deletion_private.requests SET status='retention_pending',next_attempt_at=now()+interval '1 day',lease=NULL,lease_until=NULL WHERE id=r.id;
  ELSE
   UPDATE deletion_private.requests SET status='completed',phase='done',completed_at=now(),lease=NULL,lease_until=NULL,error_code=NULL WHERE id=r.id;
   DELETE FROM deletion_private.objects WHERE request_id=r.id;
  END IF;
 ELSIF action='release' THEN
  UPDATE deletion_private.requests SET lease=NULL,lease_until=NULL,status='queued',next_attempt_at=now()+interval '1 second',attempts=0 WHERE id=r.id;
 ELSIF action='fail' THEN
  UPDATE deletion_private.requests SET status=CASE WHEN payload->>'manual'='true' OR attempts>=6 THEN 'needs_attention' ELSE 'retry_wait' END,
   error_code=left(payload->>'code',100),next_attempt_at=now()+make_interval(secs=>least(43200,60*power(5,least(attempts,5)))::integer),lease=NULL,lease_until=NULL WHERE id=r.id;
 ELSE RAISE EXCEPTION 'unknown_action'; END IF;
 RETURN '{}'::jsonb;
END $$;

COMMIT;
