-- Review the live manifest before enabling. Never run the historical generic
-- delete_user_data RPC after this migration (see deployment runbook).
BEGIN;
CREATE SCHEMA deletion_private;
REVOKE ALL ON SCHEMA deletion_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA deletion_private TO authenticated, service_role;

CREATE TABLE deletion_private.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  approved_fingerprint text,
  approved_by text,
  approved_at timestamptz,
  storage_origin text NOT NULL DEFAULT 'https://kwniiyayhzgjfqjsjcfu.supabase.co' CHECK(storage_origin ~ '^https://[a-z0-9.-]+$'),
  receipt_retention_days integer CHECK(receipt_retention_days>0),
  backup_window_days integer CHECK(backup_window_days>0)
);
INSERT INTO deletion_private.settings DEFAULT VALUES;
CREATE TABLE deletion_private.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- deliberately no FK: survives Auth deletion
  scope text NOT NULL CHECK (scope IN ('account','data')),
  source text NOT NULL CHECK (source IN ('app','web','support')),
  policy_version text NOT NULL DEFAULT '2026-09-11',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','retry_wait','needs_attention','retention_pending','completed')),
  phase text NOT NULL DEFAULT 'inventory' CHECK (phase IN ('inventory','storage','database','auth','providers','verify','done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  lease uuid,
  lease_until timestamptz,
  error_code text,
  CHECK (scope IN ('account','data'))
);
CREATE UNIQUE INDEX one_active_deletion_per_user ON deletion_private.requests(user_id) WHERE scope='account' OR status<>'completed';
CREATE TABLE deletion_private.objects (
  request_id uuid NOT NULL REFERENCES deletion_private.requests(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  path text NOT NULL,
  removed_at timestamptz,
  PRIMARY KEY(request_id,bucket,path)
);
CREATE TABLE deletion_private.provider_tasks (
  request_id uuid NOT NULL REFERENCES deletion_private.requests(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','not_applicable','retention_pending')),
  evidence text,
  locator jsonb, -- minimal provider identity; purge after evidence is recorded
  due_at timestamptz,
  resolved_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(request_id,provider),
  CHECK (status = 'pending' OR (length(trim(evidence)) >= 8 AND length(trim(resolved_by)) >= 3)),
  CHECK (status <> 'retention_pending' OR due_at IS NOT NULL)
);
CREATE TABLE deletion_private.events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES deletion_private.requests(id) ON DELETE CASCADE,
 action text NOT NULL,
 operator text NOT NULL CHECK(length(trim(operator)) BETWEEN 3 AND 100),
 evidence text NOT NULL CHECK(length(trim(evidence)) BETWEEN 8 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Explicit rules only. Additional live columns/tables require inventory review.
CREATE TABLE deletion_private.rules (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  action text NOT NULL CHECK(action IN ('delete','detach')),
  PRIMARY KEY(schema_name,table_name,column_name)
);
INSERT INTO deletion_private.rules
SELECT 'public', t, 'user_id', 'delete' FROM unnest(ARRAY[
  'user_settings','contractions','baby_diary','baby_daily','baby_care_entries',
  'baby_milestone_progress','baby_current_phase','sleep_entries','sleep_entries_new',
  'baby_sleep_tracking','baby_members','doctor_questions','user_push_tokens',
  'community_posts','community_comments','community_nested_comments','community_post_likes',
  'community_comment_likes','community_nested_comment_likes','community_notifications',
  'community_group_members','community_group_posts','community_group_comments',
  'community_group_post_likes','community_group_comment_likes','community_group_nested_comments',
  'community_group_nested_comment_likes','community_group_chat_reads',
  'community_group_messages','group_chat_event_rsvps','planner_items','planner_recurring_items',
  'planner_recurring_exceptions','planner_notifications','planner_calendar_sync_settings',
  'planner_calendar_sync_links','shopping_items','shopping_lists','shopping_list_items',
  'inventory_items','inventory_transactions','loyalty_cards','cycle_settings',
  'cycle_periods','cycle_daily_logs','baby_daily_habit_checks','baby_reminder_notifications',
  'baby_weights','baby_sizes','baby_teeth','baby_notes','custom_activity_definitions',
  'custom_activity_entries','recipes','favorite_recipes','recipe_favorites',
  'advisor_settings','advisor_daily_signals','advisor_daily_insights','advisor_insights',
  'advisor_mama_checkins','advisor_relief_events','advisor_feedback',
  'lotti_subscription_entitlements','lotti_ai_usage_buckets','lotti_ai_requests',
  'voice_log_requests','baby_info','advisor_messages','baby_milestone_entries',
  'community_group_event_rsvps','community_poll_votes','feature_requests','geburtsplan',
  'selfcare_entries','size_entries','startup_message_acknowledgements',
  'subscription_cancellation_feedback','terms_consents','tooth_entries','weight_entries',
  -- Live-schema review 2026-09-26: directly user-owned rows. Feeding rows
  -- also carry baby_id and are held by the shared-baby preflight.
  'analytics_events','baby_names_favorites','community_images','feeding_events',
  'feeding_preferences','hospital_checklist','planner_blocks','planner_days',
  'push_tokens','wiki_favorites','baby_recipes'
]) t;
INSERT INTO deletion_private.rules VALUES
 ('public','profiles','id','delete'),
 ('public','blog_posts','author_id','delete'),
 ('public','community_group_messages','sender_id','delete'),
 ('public','community_group_events','created_by_user_id','delete'),
 ('public','community_group_events','cancelled_by_user_id','detach'),
 ('public','community_notifications','sender_id','delete'),
 ('public','custom_activity_types','created_by','delete'),
 ('public','inventory_items','created_by','delete'),
 ('public','inventory_transactions','created_by','delete'),
 ('public','shopping_list_items','created_by','delete'),
 ('public','baby_daily_habit_checks','checked_by','detach'),
 ('public','product_catalog','created_by','detach'),
 ('public','partner_activity_notifications','user_id','delete'),
 ('public','partner_activity_notifications','partner_id','delete'),
 ('public','user_blocks','blocked_id','delete'),('public','user_blocks','blocker_id','delete'),
 ('public','account_links','creator_id','delete'),('public','account_links','invited_id','delete'),
 ('public','user_connections','inviter_id','delete'),('public','user_connections','invited_id','delete'),
 ('public','user_partners','user_id','delete'),('public','user_partners','partner_id','delete'),
 ('public','sleep_entry_shares','owner_id','delete'),('public','sleep_entry_shares','shared_with_id','delete'),
 ('public','user_follows','follower_id','delete'),('public','user_follows','following_id','delete'),
 ('public','direct_messages','sender_id','delete'),('public','direct_messages','receiver_id','detach'),
 ('public','lotti_recommendations','created_by','delete'),
 ('public','community_groups','owner_id','delete'),
 ('public','community_group_invites','invited_user_id','delete'),
 ('public','community_group_invites','invited_by_user_id','delete'),
 ('public','sleep_entries','partner_id','detach'),('public','sleep_entries','shared_with_user_id','detach'),
 ('public','baby_sleep_tracking','shared_with_user_id','detach'),
 ('caretaker_private','grants','owner_id','delete'),('caretaker_private','grants','caregiver_id','delete');

-- Keep other senders' messages. Removing a recipient must not cascade through
-- them; their contents remain subject to the documented manual privacy review.
DO $$ BEGIN
 IF to_regclass('public.direct_messages') IS NOT NULL THEN
  ALTER TABLE public.direct_messages ALTER COLUMN receiver_id DROP NOT NULL;
 END IF;
END $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['settings','requests','objects','provider_tasks','rules','events'] LOOP
  EXECUTE format('ALTER TABLE deletion_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON deletion_private.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;

CREATE FUNCTION deletion_private.fingerprint() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT md5(coalesce((SELECT string_agg(x,'|' ORDER BY x) FROM (
  SELECT n.nspname||'.'||c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull x
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','caretaker_private','storage') AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT conname||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','caretaker_private'))
  UNION ALL SELECT schema_name||'.'||table_name||'.'||column_name||':'||action FROM deletion_private.rules
  UNION ALL SELECT storage_origin FROM deletion_private.settings
 ) q),'none'));
$$;
CREATE FUNCTION deletion_private.blocked(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT uid IS NOT NULL AND EXISTS(SELECT 1 FROM deletion_private.requests
 WHERE user_id=uid AND (scope='account' OR status<>'completed'));
$$;
REVOKE ALL ON FUNCTION deletion_private.blocked(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION deletion_private.blocked(uuid) TO authenticated,service_role;

-- REST pre-request also covers SECURITY DEFINER RPCs. Existing pre-request
-- hooks must be composed explicitly; never overwrite another security hook.
CREATE FUNCTION public.check_account_deletion_access() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF deletion_private.blocked(auth.uid()) THEN
  RAISE EXCEPTION 'account_deletion_pending' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.check_account_deletion_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_account_deletion_access() TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION deletion_private.blocked(uuid) TO anon;
GRANT USAGE ON SCHEMA deletion_private TO anon;

-- Restrictive policies close direct access even outside PostgREST. Write
-- triggers protect against late service-role jobs and deleted account IDs.
CREATE FUNCTION deletion_private.guard_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v text; actor uuid := auth.uid();
BEGIN
 IF current_setting('deletion_private.erasing',true)='on' THEN RETURN NEW; END IF;
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
 RETURN NEW;
END $$;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind='r' AND (n.nspname IN ('public','caretaker_private') OR (n.nspname='storage' AND c.relname='objects')) LOOP
  EXECUTE format('CREATE POLICY account_deletion_deny ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT deletion_private.blocked(auth.uid())) WITH CHECK (NOT deletion_private.blocked(auth.uid()))',t.nspname,t.relname);
  EXECUTE format('CREATE TRIGGER account_deletion_guard BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION deletion_private.guard_write()',t.nspname,t.relname);
 END LOOP;
END $$;

CREATE FUNCTION deletion_private.accept(uid uuid, requested_scope text, request_source text, identity_evidence text DEFAULT NULL, verified_by text DEFAULT NULL) RETURNS jsonb
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
 IF NOT EXISTS(SELECT 1 FROM deletion_private.settings WHERE singleton AND receipt_retention_days IS NOT NULL AND backup_window_days IS NOT NULL) THEN RAISE EXCEPTION 'deletion_retention_not_configured'; END IF;
 IF approved IS NULL OR approved <> deletion_private.fingerprint() THEN RAISE EXCEPTION 'deletion_inventory_not_approved'; END IF;
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

-- Explicit preflight stops all destructive phases for unresolved shared
-- ownership. An operator resolves those references under the family policy.
CREATE FUNCTION deletion_private.preflight(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE conflict boolean; rule record;
BEGIN
 IF to_regclass('public.baby_info') IS NOT NULL AND to_regclass('public.baby_members') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.baby_info b JOIN public.baby_members m ON m.baby_id=b.id WHERE b.user_id=$1 AND m.user_id<>$1)' INTO conflict USING uid;
  IF conflict THEN RAISE EXCEPTION 'shared_baby_review_required'; END IF;
  -- A departing member may have authored data in a baby owned by another
  -- parent. Resolve that ownership before removing any related rows/media.
  FOR rule IN SELECT x.* FROM deletion_private.rules x
   JOIN information_schema.columns c ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name
   JOIN information_schema.columns b ON b.table_schema=x.schema_name AND b.table_name=x.table_name AND b.column_name='baby_id'
   WHERE x.action='delete' AND x.table_name<>'baby_members' LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I t JOIN public.baby_info b ON b.id=t.baby_id WHERE t.%I::text=$1 AND b.user_id::text IS DISTINCT FROM $1)',rule.schema_name,rule.table_name,rule.column_name) INTO conflict USING uid::text;
    IF conflict THEN RAISE EXCEPTION 'shared_baby_content_review_required'; END IF;
  END LOOP;
 END IF;
 IF to_regclass('public.community_groups') IS NOT NULL AND to_regclass('public.community_group_members') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.community_groups g JOIN public.community_group_members m ON m.group_id=g.id WHERE g.owner_id=$1 AND m.user_id<>$1)' INTO conflict USING uid;
  IF conflict THEN RAISE EXCEPTION 'shared_group_review_required'; END IF;
 END IF;
 -- A user's recipe may be published globally. The Auth FK would otherwise
 -- cascade it away even if the manifest did not mention this table.
 IF to_regclass('public.baby_recipes') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.baby_recipes WHERE user_id=$1 AND is_global)' INTO conflict USING uid;
  IF conflict THEN RAISE EXCEPTION 'global_recipe_review_required'; END IF;
 END IF;
 -- These copies and moderation records need a documented retention/redaction
 -- decision; an Auth cascade or SET NULL must not silently settle it.
 IF to_regclass('public.account_links_audit_log') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.account_links_audit_log WHERE changed_by=$1 OR coalesce(old_data::text,'''') LIKE ''%''||$1::text||''%'' OR coalesce(new_data::text,'''') LIKE ''%''||$1::text||''%'')' INTO conflict USING uid;
  IF conflict THEN RAISE EXCEPTION 'account_link_audit_review_required'; END IF;
 END IF;
 IF to_regclass('public.content_reports') IS NOT NULL THEN
  -- Includes moderator/follow-up identities and media/free-text copies. The
  -- full row keeps this compatible with older schemas lacking those columns.
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.content_reports t WHERE to_jsonb(t)::text LIKE ''%''||$1::text||''%'')' INTO conflict USING uid;
  IF conflict THEN RAISE EXCEPTION 'moderation_report_review_required'; END IF;
 END IF;
 IF to_regclass('public.subscription_policy_audit') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.subscription_policy_audit t WHERE to_jsonb(t)::text LIKE ''%''||$1::text||''%'')' INTO conflict USING uid;
  IF conflict THEN RAISE EXCEPTION 'subscription_audit_review_required'; END IF;
 END IF;
END $$;

CREATE FUNCTION deletion_private.collect_objects(rid uuid, uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rule record; row_data jsonb; item record; conflict boolean;
BEGIN
 -- Storage ownership is authoritative for orphaned and historical uploads.
 INSERT INTO deletion_private.objects(request_id,bucket,path)
 SELECT rid,bucket_id,name FROM storage.objects o
 WHERE coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')=uid::text
 ON CONFLICT DO NOTHING;
 -- Known user path segments (not arbitrary substring matches).
 INSERT INTO deletion_private.objects(request_id,bucket,path)
 SELECT rid,bucket_id,name FROM storage.objects
 WHERE (bucket_id='baby-profile-images' AND split_part(name,'/',1)=uid::text)
 OR (bucket_id='recipe-images' AND split_part(name,'/',1)='recipes' AND split_part(name,'/',2)=uid::text)
 OR (bucket_id='group-event-images' AND split_part(name,'/',2)=uid::text)
 OR (bucket_id='chat-audio' AND split_part(name,'/',2)=uid::text)
 OR (bucket_id='public-images' AND split_part(name,'/',1)='recommendation-images' AND split_part(name,'/',2)=uid::text)
 OR (bucket_id='community-images' AND split_part(name,'/',1)='avatars' AND starts_with(split_part(name,'/',2),'avatar_'||uid::text||'_'))
 OR (bucket_id='community-images' AND split_part(name,'/',1)='blog-covers' AND starts_with(split_part(name,'/',2),'blog_'||uid::text||'_'))
 OR (bucket_id='community-images' AND split_part(name,'/',1)='wiki-covers' AND starts_with(split_part(name,'/',2),'wiki_'||uid::text||'_'))
 OR (bucket_id='community-images' AND split_part(name,'/',1)='milestones' AND starts_with(split_part(name,'/',3),uid::text||'_'))
 ON CONFLICT DO NOTHING;
 -- Only the configured project origin may identify an object through a URL.
 -- A foreign URL with the same suffix is not authority to remove local media.
 FOR rule IN SELECT x.* FROM deletion_private.rules x JOIN information_schema.columns c
 ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name
 WHERE x.action='delete' LOOP
  FOR row_data IN EXECUTE format('SELECT to_jsonb(t) FROM %I.%I t WHERE %I::text=$1',rule.schema_name,rule.table_name,rule.column_name) USING uid::text LOOP
   FOR item IN SELECT key,value FROM jsonb_each_text(row_data) WHERE key ~ '(url|path|image|photo|audio)' LOOP
    INSERT INTO deletion_private.objects(request_id,bucket,path)
    SELECT rid,o.bucket_id,o.name FROM storage.objects o WHERE item.value=o.name AND item.key='audio_storage_path'
    OR item.value=(SELECT storage_origin FROM deletion_private.settings WHERE singleton)||'/storage/v1/object/public/'||o.bucket_id||'/'||o.name
    ON CONFLICT DO NOTHING;
   END LOOP;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM storage.objects o JOIN deletion_private.objects d ON d.bucket=o.bucket_id AND d.path=o.name
  WHERE d.request_id=rid AND coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner') IS NOT NULL
  AND coalesce(nullif(to_jsonb(o)->>'owner_id',''),to_jsonb(o)->>'owner')<>uid::text) THEN
  RAISE EXCEPTION 'shared_media_review_required';
 END IF;
 -- An attachment may be referenced from another account. Stop before deleting
 -- any binary until ownership/reference transfer has been explicitly resolved.
 FOR rule IN SELECT DISTINCT x.schema_name,x.table_name,x.column_name FROM deletion_private.rules x JOIN information_schema.columns c
 ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name WHERE x.action='delete' LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I t CROSS JOIN LATERAL jsonb_each_text(to_jsonb(t)) v JOIN deletion_private.objects d ON d.request_id=$1 AND (v.value=d.path OR right(v.value,length(''/storage/v1/object/public/''||d.bucket||''/''||d.path))=''/storage/v1/object/public/''||d.bucket||''/''||d.path) WHERE t.%I::text IS DISTINCT FROM $2)',rule.schema_name,rule.table_name,rule.column_name)
    INTO conflict USING rid,uid::text;
  IF conflict THEN RAISE EXCEPTION 'shared_media_review_required'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION deletion_private.erase_rows(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rule record; remaining boolean; changed bigint; pass integer; progress bigint;
BEGIN
 PERFORM set_config('deletion_private.erasing','on',true);
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

CREATE FUNCTION deletion_private.verify_rows(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rule record; found_rows boolean;
BEGIN
 FOR rule IN SELECT x.* FROM deletion_private.rules x JOIN information_schema.columns c
 ON c.table_schema=x.schema_name AND c.table_name=x.table_name AND c.column_name=x.column_name LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I::text=$1)',rule.schema_name,rule.table_name,rule.column_name) INTO found_rows USING uid::text;
  IF found_rows THEN RAISE EXCEPTION 'residual_database_rows'; END IF;
 END LOOP;
END $$;

-- One service-role-only bridge: private tables are never exposed through REST.
CREATE FUNCTION deletion_private.worker(action text, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r deletion_private.requests; result jsonb; uid uuid; object_count integer;
BEGIN
 IF action='list' THEN
  SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (SELECT r.id,r.scope,r.status,r.phase,r.created_at,r.error_code,(SELECT jsonb_agg(jsonb_build_object('provider',t.provider,'status',t.status,'due_at',t.due_at)) FROM deletion_private.provider_tasks t WHERE t.request_id=r.id) AS providers FROM deletion_private.requests r WHERE r.status<>'completed' ORDER BY r.created_at LIMIT 100) x;
  RETURN result;
 END IF;
 IF action='purge_receipts' THEN
  DELETE FROM deletion_private.requests r USING deletion_private.settings s WHERE r.status='completed' AND r.completed_at < now()-make_interval(days=>greatest(s.receipt_retention_days,s.backup_window_days)) AND s.receipt_retention_days IS NOT NULL AND s.backup_window_days IS NOT NULL;
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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA deletion_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION deletion_private.blocked(uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION deletion_private.worker(text,jsonb) TO service_role;
CREATE FUNCTION public.account_deletion_worker(action text,payload jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT deletion_private.worker(action,payload) $$;
REVOKE ALL ON FUNCTION public.account_deletion_worker(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_worker(text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_user_data(delete_auth boolean DEFAULT false) RETURNS json
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT json_build_object('success',false,'error','Bitte aktualisiere Lotti Baby oder beantrage die Löschung unter https://lottibaby.de/datenschutz#konto-loeschen.');
$$;
REVOKE ALL ON FUNCTION public.delete_user_data(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_data(boolean) TO authenticated;
COMMIT;
