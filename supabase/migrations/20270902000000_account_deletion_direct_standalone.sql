-- Direct self-service deletion for standalone accounts.
-- The job pipeline (account_deletion_worker) stays for shared accounts and
-- support cases. Accounts without partner link, shared baby, caretaker access,
-- shared media or moderation/admin history are erased by the
-- delete-own-account Edge Function without inventory approval or cron.
--
-- Safety contract:
-- * Every guarded write (guard_write) holds a SHARED barrier lock until it
--   commits. begin takes the barrier EXCLUSIVELY, so it waits for writes that
--   are already in flight, then persists the marker and the file inventory.
--   After begin, guard_write refuses rows of the user (blocked()) and any row
--   of anyone that mentions an inventoried file. A transaction whose snapshot
--   predates the latest begin cannot see the marker; it is refused with 40001.
-- * verify re-checks sharing with a fresh snapshot after begin committed (no
--   new reference can appear any more). On the first attempt a conflict
--   cancels the request before any binary was removed.
-- * erase  removes rows and, for 'account', the auth user in ONE transaction.
--          Any failure rolls back completely; the marker stays.
-- * fail   records the failure; the marker stays and the user can resume.
--          Every step is idempotent, so a retry simply continues.
BEGIN;

CREATE TABLE deletion_private.direct_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 scope text NOT NULL CHECK(scope IN ('account','data')),
 status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','failed','completed')),
 attempts integer NOT NULL DEFAULT 1 CHECK(attempts>0),
 failure_code text CHECK(failure_code IS NULL OR failure_code ~ '^[a-z_]{3,64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 verified_at timestamptz,
 completed_at timestamptz
);
-- No FK to auth.users: the completed account receipt must outlive the user.
CREATE UNIQUE INDEX direct_requests_one_open ON deletion_private.direct_requests(user_id) WHERE status<>'completed';
CREATE INDEX direct_requests_user ON deletion_private.direct_requests(user_id);
ALTER TABLE deletion_private.direct_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deletion_private.direct_requests FROM PUBLIC,anon,authenticated,service_role;

-- Same semantics as before plus the direct marker. A completed data reset
-- unblocks; an account deletion stays blocked for its (deleted) id.
CREATE OR REPLACE FUNCTION deletion_private.blocked(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT uid IS NOT NULL AND (
  EXISTS(SELECT 1 FROM deletion_private.requests
   WHERE user_id=uid AND (scope='account' OR status<>'completed'))
  OR EXISTS(SELECT 1 FROM deletion_private.direct_requests
   WHERE user_id=uid AND (scope='account' OR status<>'completed')));
$$;

-- Files of open direct requests. Foreign rows must not start referencing them.
CREATE TABLE deletion_private.direct_inventory (
 request_id uuid NOT NULL REFERENCES deletion_private.direct_requests(id) ON DELETE CASCADE,
 bucket text NOT NULL,
 path text NOT NULL,
 PRIMARY KEY(request_id,bucket,path)
);
ALTER TABLE deletion_private.direct_inventory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deletion_private.direct_inventory FROM PUBLIC,anon,authenticated,service_role;
-- Non-transactional: the xid of the latest begin, visible to every session at once.
CREATE SEQUENCE deletion_private.direct_begin_xid MINVALUE 1 NO MAXVALUE NO CYCLE;
REVOKE ALL ON SEQUENCE deletion_private.direct_begin_xid FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION deletion_private.direct_barrier_key() RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 7340021911062027::bigint $$;

-- Live definition (catalog 2026-10-16) plus the barrier, the stale-snapshot
-- check and the inventory check. Existing checks are unchanged.
CREATE OR REPLACE FUNCTION deletion_private.guard_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text; actor uuid := auth.uid(); latest bigint;
BEGIN
 IF current_setting('deletion_private.erasing',true)='on' THEN RETURN NEW; END IF;
 -- Held until commit: a direct begin waits for this write to finish.
 PERFORM pg_advisory_xact_lock_shared(deletion_private.direct_barrier_key());
 SELECT last_value INTO latest FROM deletion_private.direct_begin_xid;
 IF latest>1 AND NOT pg_visible_in_snapshot(latest::text::xid8,pg_current_snapshot()) THEN
  RAISE EXCEPTION 'account_deletion_retry' USING ERRCODE='40001';
 END IF;
 IF deletion_private.blocked(actor) THEN RAISE EXCEPTION 'account_deletion_pending' USING ERRCODE='42501'; END IF;
 FOR v IN SELECT value FROM jsonb_each_text(to_jsonb(NEW)) WHERE key=ANY(ARRAY[
  'user_id','owner_id','sender_id','receiver_id','created_by','creator_id','invited_id',
  'caregiver_id','follower_id','following_id','shared_with_user_id','partner_id','owner',
  'author_id','checked_by','created_by_user_id','cancelled_by_user_id',
  'invited_user_id','invited_by_user_id','blocked_id','blocker_id',
  'inviter_id','shared_with_id','reporter_id','reported_user_id',
  'changed_by','updated_by','follow_up_by','resolved_by'
 ]) LOOP
  IF v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND deletion_private.blocked(v::uuid) THEN
   RAISE EXCEPTION 'account_deletion_pending' USING ERRCODE='42501';
  END IF;
 END LOOP;
 IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='profiles' AND deletion_private.blocked((to_jsonb(NEW)->>'id')::uuid) THEN
  RAISE EXCEPTION 'account_deletion_pending' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM deletion_private.direct_requests WHERE status<>'completed')
  AND EXISTS(SELECT 1 FROM deletion_private.direct_inventory i JOIN deletion_private.direct_requests r
   ON r.id=i.request_id AND r.status<>'completed' WHERE strpos(to_jsonb(NEW)::text,i.path)>0) THEN
  RAISE EXCEPTION 'account_deletion_pending' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;

-- Tables created after the original guard rollout get the same protection.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND (n.nspname IN ('public','caretaker_private') OR (n.nspname='storage' AND c.relname='objects'))
 AND NOT EXISTS(SELECT 1 FROM pg_trigger g WHERE g.tgrelid=c.oid AND g.tgname='account_deletion_guard') LOOP
  EXECUTE format('CREATE TRIGGER account_deletion_guard BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION deletion_private.guard_write()',t.nspname,t.relname);
 END LOOP;
END $$;

-- Storage objects of the user: uploader ownership plus known per-user paths.
CREATE OR REPLACE FUNCTION deletion_private.direct_objects(uid uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('bucket',o.bucket_id,'path',o.name)),'[]'::jsonb)
 FROM storage.objects o
 WHERE coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')=uid::text
 OR (o.bucket_id='baby-profile-images' AND split_part(o.name,'/',1)=uid::text)
 OR (o.bucket_id='recipe-images' AND split_part(o.name,'/',1)='recipes' AND split_part(o.name,'/',2)=uid::text)
 OR (o.bucket_id='group-event-images' AND split_part(o.name,'/',2)=uid::text)
 OR (o.bucket_id='chat-audio' AND split_part(o.name,'/',2)=uid::text)
 OR (o.bucket_id='public-images' AND split_part(o.name,'/',1)='recommendation-images' AND split_part(o.name,'/',2)=uid::text)
 OR (o.bucket_id='community-images' AND split_part(o.name,'/',1)='avatars' AND starts_with(split_part(o.name,'/',2),'avatar_'||uid::text||'_'))
 OR (o.bucket_id='community-images' AND split_part(o.name,'/',1)='blog-covers' AND starts_with(split_part(o.name,'/',2),'blog_'||uid::text||'_'))
 OR (o.bucket_id='community-images' AND split_part(o.name,'/',1)='wiki-covers' AND starts_with(split_part(o.name,'/',2),'wiki_'||uid::text||'_'))
 OR (o.bucket_id='community-images' AND split_part(o.name,'/',1)='milestones' AND starts_with(split_part(o.name,'/',3),uid::text||'_'));
$$;

-- True when any row NOT owned by uid mentions one of uid's storage paths
-- (plain path, public/signed URL or any other embedding). A false positive only
-- routes the account to the reviewed path; it never deletes shared media.
CREATE OR REPLACE FUNCTION deletion_private.direct_shared_media(uid uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE tbl record; objects jsonb; conflict boolean;
BEGIN
 objects := deletion_private.direct_objects(uid);
 IF jsonb_array_length(objects)=0 THEN RETURN false; END IF;
 -- Scan every table the manifest knows (kept 'detach' rows included). A row is
 -- the user's own only through a column that is deleted with the account.
 FOR tbl IN
  SELECT q.schema_name,q.table_name,coalesce(string_agg(format('coalesce(t.%I::text=$2,false)',q.column_name),' OR ') FILTER (WHERE q.owned),'false') AS mine
  FROM (
   SELECT x.schema_name,x.table_name,x.column_name,x.action='delete' AS owned FROM deletion_private.rules x
   JOIN information_schema.columns c ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name
   WHERE x.action IN ('delete','detach')
   UNION
   SELECT c.table_schema,c.table_name,c.column_name,true FROM information_schema.columns c
   JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
   WHERE c.table_schema='public' AND c.column_name='user_id'
  ) q GROUP BY q.schema_name,q.table_name
 LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I t CROSS JOIN jsonb_array_elements($1) o
   WHERE NOT (%s) AND strpos(to_jsonb(t)::text,o->>''path'')>0)',tbl.schema_name,tbl.table_name,tbl.mine)
   INTO conflict USING objects,uid::text;
  IF conflict THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $$;

-- NULL means the account is standalone. Otherwise a short reason code.
CREATE OR REPLACE FUNCTION deletion_private.direct_blocker(uid uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE conflict boolean; rule record;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RETURN 'account_not_found'; END IF;
 IF EXISTS(SELECT 1 FROM deletion_private.requests WHERE user_id=uid AND (scope='account' OR status<>'completed')) THEN RETURN 'request_pending'; END IF;
 IF to_regclass('public.account_links') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.account_links WHERE status=''accepted'' AND invited_id IS NOT NULL AND (creator_id=$1 OR invited_id=$1))' INTO conflict USING uid;
  IF conflict THEN RETURN 'linked_account'; END IF;
 END IF;
 IF to_regclass('public.baby_members') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.baby_members mine JOIN public.baby_members other ON other.baby_id=mine.baby_id AND other.user_id<>$1 WHERE mine.user_id=$1)' INTO conflict USING uid;
  IF conflict THEN RETURN 'shared_baby'; END IF;
  IF to_regclass('public.baby_info') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.baby_info b JOIN public.baby_members m ON m.baby_id=b.id WHERE b.user_id=$1 AND m.user_id<>$1)
    OR EXISTS(SELECT 1 FROM public.baby_members m JOIN public.baby_info b ON b.id=m.baby_id WHERE m.user_id=$1 AND b.user_id IS DISTINCT FROM $1)' INTO conflict USING uid;
   IF conflict THEN RETURN 'shared_baby'; END IF;
  END IF;
 END IF;
 -- Rows authored in a baby owned by someone else belong to that family.
 IF to_regclass('public.baby_info') IS NOT NULL THEN
  FOR rule IN SELECT x.* FROM deletion_private.rules x
   JOIN information_schema.columns c ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name
   JOIN information_schema.columns b ON b.table_schema=x.schema_name AND b.table_name=x.table_name AND b.column_name='baby_id'
   WHERE x.action='delete' AND x.table_name<>'baby_members' LOOP
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I t JOIN public.baby_info b ON b.id=t.baby_id WHERE t.%I::text=$1 AND b.user_id::text IS DISTINCT FROM $1)',rule.schema_name,rule.table_name,rule.column_name) INTO conflict USING uid::text;
   IF conflict THEN RETURN 'shared_baby'; END IF;
  END LOOP;
 END IF;
 IF to_regclass('caretaker_private.grants') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM caretaker_private.grants WHERE (owner_id=$1 OR caregiver_id=$1) AND caregiver_id IS NOT NULL AND revoked_at IS NULL AND ends_at>now())' INTO conflict USING uid;
  IF conflict THEN RETURN 'caretaker_access'; END IF;
 END IF;
 IF to_regclass('public.community_groups') IS NOT NULL AND to_regclass('public.community_group_members') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.community_groups g JOIN public.community_group_members m ON m.group_id=g.id WHERE g.owner_id=$1 AND m.user_id<>$1)' INTO conflict USING uid;
  IF conflict THEN RETURN 'community_group'; END IF;
 END IF;
 IF to_regclass('public.baby_recipes') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.baby_recipes WHERE user_id=$1 AND is_global)' INTO conflict USING uid;
  IF conflict THEN RETURN 'review_required'; END IF;
 END IF;
 IF to_regclass('public.content_reports') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.content_reports t WHERE to_jsonb(t)::text LIKE ''%''||$1::text||''%'')' INTO conflict USING uid;
  IF conflict THEN RETURN 'review_required'; END IF;
 END IF;
 IF to_regclass('public.subscription_policy_audit') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.subscription_policy_audit WHERE changed_by=$1)' INTO conflict USING uid;
  IF conflict THEN RETURN 'review_required'; END IF;
 END IF;
 IF deletion_private.direct_shared_media(uid) THEN RETURN 'shared_media'; END IF;
 RETURN NULL;
END $$;

-- Persist the marker and file inventory (or resume an open request). The
-- exclusive barrier waits for in-flight guarded writes; lock_timeout keeps a
-- slow writer from stalling the app. Fast on purpose: no table scans here.
CREATE OR REPLACE FUNCTION deletion_private.direct_begin(uid uuid, requested_scope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r deletion_private.direct_requests;
BEGIN
 IF uid IS NULL OR requested_scope NOT IN ('account','data') THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(deletion_private.direct_barrier_key());
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 PERFORM setval('deletion_private.direct_begin_xid',greatest(txid_current(),2));
 SELECT * INTO r FROM deletion_private.direct_requests WHERE user_id=uid AND status<>'completed';
 IF FOUND THEN
  IF r.scope<>requested_scope THEN RAISE EXCEPTION 'direct_scope_conflict'; END IF;
  UPDATE deletion_private.direct_requests SET status='in_progress',attempts=attempts+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'standalone_check_failed:account_not_found'; END IF;
  INSERT INTO deletion_private.direct_requests(user_id,scope) VALUES(uid,requested_scope) RETURNING * INTO r;
 END IF;
 INSERT INTO deletion_private.direct_inventory(request_id,bucket,path)
 SELECT r.id,o->>'bucket',o->>'path' FROM jsonb_array_elements(deletion_private.direct_objects(uid)) o
 ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('requestId',r.id,'attempts',r.attempts);
END $$;

-- Runs after begin committed: every earlier write is visible, later ones are
-- refused. A conflict on the first attempt cancels the request (no binary has
-- been removed yet); on a resumed request it stays locked for review.
CREATE OR REPLACE FUNCTION deletion_private.direct_verify(uid uuid, requested_scope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r deletion_private.direct_requests; blocker text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT * INTO r FROM deletion_private.direct_requests WHERE user_id=uid AND status<>'completed' FOR UPDATE;
 IF NOT FOUND OR r.scope<>requested_scope THEN RAISE EXCEPTION 'direct_request_missing'; END IF;
 blocker := deletion_private.direct_blocker(uid);
 IF blocker IS NOT NULL THEN
  IF r.attempts=1 THEN
   DELETE FROM deletion_private.direct_requests WHERE id=r.id;
   RETURN jsonb_build_object('cancelled',true,'reason',blocker);
  END IF;
  RAISE EXCEPTION 'direct_review_required';
 END IF;
 UPDATE deletion_private.direct_requests SET verified_at=now() WHERE id=r.id;
 -- Anything the user's prefix rules match but begin missed is added now.
 INSERT INTO deletion_private.direct_inventory(request_id,bucket,path)
 SELECT r.id,o->>'bucket',o->>'path' FROM jsonb_array_elements(deletion_private.direct_objects(uid)) o
 ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('cancelled',false,'objects',
  (SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',i.bucket,'path',i.path)),'[]'::jsonb)
   FROM deletion_private.direct_inventory i WHERE i.request_id=r.id));
END $$;

-- One transaction: detach, delete in FK-tolerant passes, verify, delete the
-- auth user ('account') and complete the marker. Any error rolls back all of it.
CREATE OR REPLACE FUNCTION deletion_private.direct_erase(uid uuid, requested_scope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r deletion_private.direct_requests; rule record; remaining boolean; changed bigint; pass integer; progress bigint; found_rows boolean; keep text[];
BEGIN
 IF uid IS NULL OR requested_scope NOT IN ('account','data') THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT * INTO r FROM deletion_private.direct_requests WHERE user_id=uid AND status<>'completed' FOR UPDATE;
 IF NOT FOUND OR r.scope<>requested_scope THEN RAISE EXCEPTION 'direct_request_missing'; END IF;
 IF r.verified_at IS NULL THEN RAISE EXCEPTION 'direct_not_verified'; END IF;
 -- New uploads are blocked by the marker; anything left means storage removal failed.
 IF jsonb_array_length(deletion_private.direct_objects(uid))>0 THEN RAISE EXCEPTION 'residual_storage_objects'; END IF;
 keep := CASE WHEN requested_scope='data'
  THEN ARRAY['lotti_subscription_entitlements','terms_consents','user_push_tokens','push_tokens']
  ELSE ARRAY[]::text[] END;
 PERFORM set_config('deletion_private.erasing','on',true);

 DROP TABLE IF EXISTS pg_temp.direct_erase_targets;
 CREATE TEMP TABLE direct_erase_targets ON COMMIT DROP AS
 SELECT DISTINCT q.schema_name,q.table_name,q.column_name FROM (
  SELECT x.schema_name,x.table_name,x.column_name FROM deletion_private.rules x
  JOIN information_schema.columns c ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name
  WHERE x.action='delete' AND NOT (requested_scope='data' AND x.schema_name='consent_private')
  UNION
  SELECT c.table_schema,c.table_name,c.column_name FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
  WHERE c.table_schema='public' AND c.column_name='user_id'
 ) q WHERE NOT (q.schema_name='public' AND q.table_name=ANY(keep));

 FOR rule IN SELECT x.* FROM deletion_private.rules x JOIN information_schema.columns c
  ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name WHERE x.action='detach' LOOP
  EXECUTE format('UPDATE %I.%I SET %I=NULL WHERE %I::text=$1',rule.schema_name,rule.table_name,rule.column_name,rule.column_name) USING uid::text;
 END LOOP;

 FOR pass IN 1..20 LOOP
  remaining := false; progress := 0;
  FOR rule IN SELECT * FROM pg_temp.direct_erase_targets
   ORDER BY CASE WHEN table_name='profiles' THEN 2 WHEN table_name='baby_info' THEN 1 ELSE 0 END LOOP
   BEGIN
    EXECUTE format('DELETE FROM %I.%I WHERE %I::text=$1',rule.schema_name,rule.table_name,rule.column_name) USING uid::text;
    GET DIAGNOSTICS changed=ROW_COUNT; progress:=progress+changed;
   EXCEPTION WHEN foreign_key_violation THEN remaining:=true;
   END;
  END LOOP;
  EXIT WHEN NOT remaining;
  IF progress=0 THEN RAISE EXCEPTION 'unresolved_foreign_key'; END IF;
 END LOOP;
 IF remaining THEN RAISE EXCEPTION 'deletion_dependency_limit'; END IF;
 -- History of dissolved partner links (after the passes: the audit trigger
 -- logs the account_links deletions above). No accepted link exists here.
 IF to_regclass('public.account_links_audit_log') IS NOT NULL THEN
  EXECUTE 'DELETE FROM public.account_links_audit_log WHERE changed_by=$1 OR coalesce(old_data::text,'''') LIKE ''%''||$1::text||''%'' OR coalesce(new_data::text,'''') LIKE ''%''||$1::text||''%''' USING uid;
 END IF;

 FOR rule IN SELECT * FROM pg_temp.direct_erase_targets LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I::text=$1)',rule.schema_name,rule.table_name,rule.column_name) INTO found_rows USING uid::text;
  IF found_rows THEN RAISE EXCEPTION 'residual_database_rows'; END IF;
 END LOOP;
 IF requested_scope='account' THEN
  -- Same transaction as the row erasure: no state with data gone but login left.
  -- Identities, sessions and refresh tokens cascade inside auth.
  DELETE FROM auth.users WHERE id=uid;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'auth_still_exists'; END IF;
 END IF;
 UPDATE deletion_private.direct_requests SET status='completed',failure_code=NULL,updated_at=now(),completed_at=now() WHERE id=r.id;
 DELETE FROM deletion_private.direct_inventory WHERE request_id=r.id;
 PERFORM set_config('deletion_private.erasing','off',true);
 RETURN jsonb_build_object('requestId',r.id,'scope',requested_scope,'status','completed');
END $$;

CREATE OR REPLACE FUNCTION deletion_private.direct_fail(uid uuid, code text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 UPDATE deletion_private.direct_requests SET status='failed',updated_at=now(),
  failure_code=CASE WHEN code ~ '^[a-z_]{3,64}$' THEN code ELSE 'temporary_failure' END
 WHERE user_id=uid AND status<>'completed';
$$;

REVOKE ALL ON FUNCTION deletion_private.direct_objects(uuid),deletion_private.direct_shared_media(uuid),
 deletion_private.direct_blocker(uuid),deletion_private.direct_begin(uuid,text),deletion_private.direct_verify(uuid,text),
 deletion_private.direct_erase(uuid,text),deletion_private.direct_fail(uuid,text) FROM PUBLIC,anon,authenticated;

-- Service-role bridge for the delete-own-account Edge Function only.
CREATE OR REPLACE FUNCTION public.account_deletion_direct(action text, payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; blocker text; pending text;
BEGIN
 uid := (payload->>'userId')::uuid;
 IF action='check' THEN
  SELECT scope INTO pending FROM deletion_private.direct_requests WHERE user_id=uid AND status<>'completed';
  IF pending IS NOT NULL THEN RETURN jsonb_build_object('available',true,'reason',NULL,'pending',pending); END IF;
  blocker := deletion_private.direct_blocker(uid);
  RETURN jsonb_build_object('available',blocker IS NULL,'reason',blocker,'pending',NULL);
 ELSIF action='begin' THEN
  -- Cheap early refusal; verify repeats the full check after the barrier.
  IF NOT EXISTS(SELECT 1 FROM deletion_private.direct_requests WHERE user_id=uid AND status<>'completed') THEN
   blocker := deletion_private.direct_blocker(uid);
   IF blocker IS NOT NULL THEN RAISE EXCEPTION 'standalone_check_failed:%',blocker; END IF;
  END IF;
  RETURN deletion_private.direct_begin(uid,payload->>'scope');
 ELSIF action='verify' THEN
  RETURN deletion_private.direct_verify(uid,payload->>'scope');
 ELSIF action='erase' THEN
  RETURN deletion_private.direct_erase(uid,payload->>'scope');
 ELSIF action='fail' THEN
  PERFORM deletion_private.direct_fail(uid,payload->>'code');
  RETURN jsonb_build_object('recorded',true);
 END IF;
 RAISE EXCEPTION 'invalid_request';
END $$;
REVOKE ALL ON FUNCTION public.account_deletion_direct(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_direct(text,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
