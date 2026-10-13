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
 IF r.lease IS DISTINCT FROM (payload->>'lease')::uuid OR r.lease_until<now() THEN RAISE EXCEPTION 'lease_lost'; END IF;
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
  IF EXISTS(SELECT 1 FROM deletion_private.provider_tasks WHERE request_id=r.id AND status='pending') THEN
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
