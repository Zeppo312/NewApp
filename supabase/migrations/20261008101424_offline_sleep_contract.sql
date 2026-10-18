-- LOCAL CANDIDATE ONLY. Disabled until schema, clients and deletion inventory
-- are reviewed on the destination. No production activation in this migration.
BEGIN;
CREATE SCHEMA sleep_sync_private;
REVOKE ALL ON SCHEMA sleep_sync_private FROM PUBLIC;
CREATE TABLE sleep_sync_private.settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false,
 compatibility_evidence text, CHECK(NOT enabled OR (compatibility_evidence IS NOT NULL AND length(trim(compatibility_evidence))>=20)));
INSERT INTO sleep_sync_private.settings(singleton) VALUES(true);
CREATE TABLE sleep_sync_private.scopes(baby_id uuid PRIMARY KEY REFERENCES public.baby_info(id) ON DELETE CASCADE, revision bigint NOT NULL DEFAULT 0);
CREATE TABLE sleep_sync_private.tickets(transaction_id bigint PRIMARY KEY,actor_id uuid NOT NULL);
CREATE TABLE sleep_sync_private.receipts(
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, operation_id uuid NOT NULL,
 baby_id uuid NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
 payload_digest text NOT NULL, outcome text NOT NULL CHECK(outcome IN('stopped','discarded','mutated')),
 committed_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(actor_id,operation_id));
ALTER TABLE sleep_sync_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sync_private.scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sync_private.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sync_private.receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sleep_sync_private FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.sleep_entries ADD COLUMN sync_revision bigint NOT NULL DEFAULT 1 CHECK(sync_revision>0);
INSERT INTO sleep_sync_private.scopes(baby_id) SELECT id FROM public.baby_info;

CREATE FUNCTION sleep_sync_private.guard_writer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (SELECT enabled FROM sleep_sync_private.settings WHERE singleton)
   AND NOT EXISTS(SELECT 1 FROM sleep_sync_private.tickets WHERE transaction_id=txid_current() AND actor_id=auth.uid())
   AND NOT (coalesce(current_setting('deletion_private.erasing',true),'')='on' AND auth.uid() IS NULL
     AND auth.role()='service_role') THEN
   RAISE EXCEPTION 'sleep_client_upgrade_required' USING ERRCODE='55000';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 NEW.sync_revision := CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.sync_revision+1 END;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_sleep_version_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sleep_entries
 FOR EACH ROW EXECUTE FUNCTION sleep_sync_private.guard_writer();
CREATE FUNCTION sleep_sync_private.bump_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid;
BEGIN
 FOR bid IN SELECT DISTINCT b FROM unnest(ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.baby_id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.baby_id END]) b WHERE b IS NOT NULL ORDER BY b LOOP
  INSERT INTO sleep_sync_private.scopes(baby_id,revision) VALUES(bid,1) ON CONFLICT(baby_id) DO UPDATE SET revision=sleep_sync_private.scopes.revision+1;
 END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER sleep_scope_revision AFTER INSERT OR UPDATE OR DELETE ON public.sleep_entries
 FOR EACH ROW EXECUTE FUNCTION sleep_sync_private.bump_scope();

CREATE FUNCTION sleep_sync_private.actor_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid())
 AND NOT deletion_private.blocked(auth.uid()) AND consent_private.family_allowed(auth.uid(),'health')
$$;
CREATE FUNCTION sleep_sync_private.baby_readable(bid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.baby_info b WHERE b.id=bid AND
 (b.user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.baby_members m WHERE m.baby_id=b.id AND m.user_id=auth.uid())
 OR EXISTS(SELECT 1 FROM public.account_links l WHERE l.status='accepted' AND
 ((l.creator_id=auth.uid() AND l.invited_id=b.user_id) OR (l.invited_id=auth.uid() AND l.creator_id=b.user_id)))))
$$;
CREATE FUNCTION sleep_sync_private.entry_visible(e public.sleep_entries) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT consent_private.row_allowed(to_jsonb(e)) AND NOT deletion_private.blocked(e.user_id) AND
 (e.user_id=auth.uid() OR (e.baby_id IS NOT NULL AND sleep_sync_private.baby_readable(e.baby_id))
 OR EXISTS(SELECT 1 FROM public.account_links l WHERE l.status='accepted' AND
 ((l.creator_id=auth.uid() AND l.invited_id=e.user_id) OR (l.invited_id=auth.uid() AND l.creator_id=e.user_id)))
 OR e.shared_with_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.sleep_entry_shares s WHERE s.entry_id=e.id AND s.shared_with_id=auth.uid()))
$$;
CREATE FUNCTION sleep_sync_private.entry_writable(e public.sleep_entries) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 -- Preserve the owner/partner boundary from the captured QA permission trigger.
 SELECT sleep_sync_private.entry_visible(e) AND (e.user_id=auth.uid() OR
 (e.partner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.account_links l WHERE l.status='accepted' AND l.relationship_type='partner' AND
 ((l.creator_id=auth.uid() AND l.invited_id=e.user_id) OR (l.invited_id=auth.uid() AND l.creator_id=e.user_id)))))
$$;
CREATE FUNCTION sleep_sync_private.entry_json(e public.sleep_entries) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',e.id,'user_id',e.user_id,'baby_id',e.baby_id,'start_time',e.start_time,'end_time',e.end_time,
 'duration_minutes',e.duration_minutes,'notes',e.notes,'quality',e.quality,'partner_id',e.partner_id,'shared_with_user_id',e.shared_with_user_id,
 'updated_by',e.updated_by,'sync_revision',e.sync_revision::text)
$$;
CREATE FUNCTION sleep_sync_private.snapshot(bid uuid,target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entries jsonb; original jsonb; rev text; complete boolean;
BEGIN
 IF NOT sleep_sync_private.actor_allowed() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF bid IS NULL THEN RETURN jsonb_build_object('status','not_available'); END IF;
 complete := sleep_sync_private.baby_readable(bid);
 IF NOT complete THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 -- One SQL statement gives revision and rows from the same MVCC snapshot.
 SELECT coalesce(s.revision,0)::text,
  coalesce((SELECT jsonb_agg(sleep_sync_private.entry_json(e) ORDER BY e.id) FROM public.sleep_entries e
    WHERE e.baby_id=bid AND sleep_sync_private.entry_visible(e)),'[]'::jsonb),
  (SELECT sleep_sync_private.entry_json(e) FROM public.sleep_entries e WHERE e.id=target AND e.baby_id=bid AND sleep_sync_private.entry_visible(e))
 INTO rev,entries,original FROM (SELECT 1) anchor LEFT JOIN sleep_sync_private.scopes s ON s.baby_id=bid;
 -- If any scope row is hidden by consent/deletion, do not certify completeness.
 IF EXISTS(SELECT 1 FROM public.sleep_entries e WHERE e.baby_id=bid AND NOT sleep_sync_private.entry_visible(e)) THEN
  RETURN jsonb_build_object('status','not_available');
 END IF;
 RETURN jsonb_build_object('status','available','babyId',bid,'scopeRevision',rev,'entries',entries,'original',original,
  'canWrite',EXISTS(SELECT 1 FROM public.sleep_entries e WHERE e.id=target AND e.baby_id=bid AND sleep_sync_private.entry_writable(e)),
  'verifiedAt',clock_timestamp());
END $$;
CREATE FUNCTION sleep_sync_private.capability() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',1,'enabled',s.enabled AND sleep_sync_private.actor_allowed(),'legacyWritersBlocked',s.enabled)
 FROM sleep_sync_private.settings s WHERE singleton
$$;
CREATE FUNCTION sleep_sync_private.commit_stop(op uuid,expected_actor uuid,bid uuid,target uuid,expected_entry bigint,expected_scope bigint,
 stop_at timestamptz,quality text,notes text,change_quality boolean,change_notes boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sleep_entries; receipt sleep_sync_private.receipts; body jsonb; digest text; current_scope bigint; outcome text;
BEGIN
 IF NOT (SELECT enabled FROM sleep_sync_private.settings WHERE singleton) THEN RETURN jsonb_build_object('status','not_available'); END IF;
 IF expected_actor IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF op IS NULL OR bid IS NULL OR target IS NULL OR expected_entry IS NULL OR expected_scope IS NULL OR stop_at IS NULL
 OR change_quality IS NULL OR change_notes IS NULL OR (quality IS NOT NULL AND quality NOT IN('good','medium','bad')) OR length(notes)>10000 THEN
  RETURN jsonb_build_object('status','invalid','reason','invalid_payload'); END IF;
 -- The table lock also excludes direct/legacy writers and new active IDs.
 -- Keep this transaction short. Destination load tests remain a rollout gate.
 LOCK TABLE public.sleep_entries IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.baby_info,public.baby_members,public.account_links,public.sleep_entry_shares,
  consent_private.decisions,consent_private.user_state,deletion_private.requests IN SHARE MODE;
 IF NOT sleep_sync_private.actor_allowed() OR NOT sleep_sync_private.baby_readable(bid) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 body := jsonb_build_array(bid,target,expected_entry::text,expected_scope::text,
  to_char(stop_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),quality,notes,change_quality,change_notes);
 digest := encode(sha256(convert_to(body::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM sleep_sync_private.receipts WHERE actor_id=auth.uid() AND operation_id=op;
 IF FOUND THEN
  IF receipt.payload_digest<>digest THEN RETURN jsonb_build_object('status','invalid','reason','operation_payload_changed'); END IF;
  RETURN jsonb_build_object('status','already_applied','operationId',op,'outcome',receipt.outcome,'committedAt',receipt.committed_at);
 END IF;
 SELECT * INTO e FROM public.sleep_entries WHERE id=target;
 IF NOT FOUND OR e.baby_id IS DISTINCT FROM bid OR NOT sleep_sync_private.entry_visible(e) THEN
  RETURN jsonb_build_object('status','not_available'); END IF;
 IF NOT sleep_sync_private.entry_writable(e) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT revision INTO current_scope FROM sleep_sync_private.scopes WHERE baby_id=bid;
 IF e.sync_revision<>expected_entry OR coalesce(current_scope,0)<>expected_scope THEN
  RETURN jsonb_build_object('status','conflict','currentSnapshot',sleep_sync_private.snapshot(bid,target)); END IF;
 IF stop_at<e.start_time OR stop_at>clock_timestamp()+interval '5 minutes' OR stop_at-e.start_time>interval '24 hours' THEN
  RETURN jsonb_build_object('status','invalid','reason','invalid_stop_time'); END IF;
 INSERT INTO sleep_sync_private.tickets VALUES(txid_current(),auth.uid());
 IF stop_at-e.start_time<interval '1 minute' THEN
  DELETE FROM public.sleep_entries WHERE id=target;
  outcome := 'discarded';
 ELSE
  UPDATE public.sleep_entries SET end_time=stop_at,duration_minutes=round(extract(epoch FROM(stop_at-start_time))/60),
   quality=CASE WHEN change_quality THEN commit_stop.quality ELSE e.quality END,
   notes=CASE WHEN change_notes THEN commit_stop.notes ELSE e.notes END,updated_by=auth.uid() WHERE id=target;
  outcome := 'stopped';
 END IF;
 DELETE FROM sleep_sync_private.tickets WHERE transaction_id=txid_current();
 INSERT INTO sleep_sync_private.receipts(actor_id,operation_id,baby_id,payload_digest,outcome) VALUES(auth.uid(),op,bid,digest,outcome);
 RETURN jsonb_build_object('status','applied','operationId',op,'outcome',outcome,'currentSnapshot',sleep_sync_private.snapshot(bid,target));
END $$;
-- Atomic online create/edit/delete batches; split/merge can use one batch.
-- Unknown fields and scope moves are deliberately rejected.
CREATE FUNCTION sleep_sync_private.mutate(op uuid,expected_actor uuid,bid uuid,expected_scope bigint,changes jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb; e public.sleep_entries; result_ids jsonb := '[]'; digest text; receipt sleep_sync_private.receipts;
 rev bigint; peer uuid; entry_start timestamptz; entry_end timestamptz; created uuid; action text;
BEGIN
 IF NOT (SELECT enabled FROM sleep_sync_private.settings WHERE singleton) THEN RETURN jsonb_build_object('status','not_available'); END IF;
 IF expected_actor IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 IF op IS NULL OR bid IS NULL OR expected_scope IS NULL OR jsonb_typeof(changes) IS DISTINCT FROM 'array' OR jsonb_array_length(changes) NOT BETWEEN 1 AND 32 THEN
  RETURN jsonb_build_object('status','invalid'); END IF;
 LOCK TABLE public.sleep_entries IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.baby_info,public.baby_members,public.account_links,public.sleep_entry_shares,
  consent_private.decisions,consent_private.user_state,deletion_private.requests IN SHARE MODE;
 IF NOT sleep_sync_private.actor_allowed() OR NOT sleep_sync_private.baby_readable(bid) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 digest := encode(sha256(convert_to(jsonb_build_array(bid,expected_scope::text,changes)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM sleep_sync_private.receipts WHERE actor_id=auth.uid() AND operation_id=op;
 IF FOUND THEN
  IF receipt.payload_digest<>digest THEN RETURN jsonb_build_object('status','invalid'); END IF;
  RETURN jsonb_build_object('status','already_applied','operationId',op,'currentSnapshot',sleep_sync_private.snapshot(bid,NULL));
 END IF;
 SELECT revision INTO rev FROM sleep_sync_private.scopes WHERE baby_id=bid;
 IF coalesce(rev,0)<>expected_scope THEN RETURN jsonb_build_object('status','conflict','currentSnapshot',sleep_sync_private.snapshot(bid,NULL)); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(changes) x WHERE x->>'action'<>'create' GROUP BY x->>'id' HAVING count(*)>1) THEN RETURN jsonb_build_object('status','invalid'); END IF;
 -- Complete validation happens before any DML, so a rejected batch is inert.
 FOR item IN SELECT value FROM jsonb_array_elements(changes) LOOP
  e := NULL;
  action := item->>'action';
  IF action IS NULL OR action NOT IN('create','update','delete') OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN('action','id','revision','fields'))
    OR jsonb_typeof(item->'fields') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item->'fields') k WHERE k NOT IN('start_time','end_time','notes','quality')) THEN RETURN jsonb_build_object('status','invalid'); END IF;
  IF action<>'create' THEN
   SELECT * INTO e FROM public.sleep_entries WHERE id=(item->>'id')::uuid AND baby_id=bid;
   IF NOT FOUND OR NOT sleep_sync_private.entry_writable(e) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
   IF e.sync_revision IS DISTINCT FROM (item->>'revision')::bigint THEN RETURN jsonb_build_object('status','conflict','currentSnapshot',sleep_sync_private.snapshot(bid,e.id)); END IF;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.baby_info b WHERE b.id=bid AND (b.user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.baby_members m WHERE m.baby_id=bid AND m.user_id=auth.uid() AND m.role IN('parent','partner')))) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  END IF;
  IF action<>'delete' THEN
   entry_start := CASE WHEN item->'fields' ? 'start_time' THEN (item->'fields'->>'start_time')::timestamptz ELSE e.start_time END;
   entry_end := CASE WHEN item->'fields' ? 'end_time' THEN (item->'fields'->>'end_time')::timestamptz WHEN action='create' THEN NULL ELSE e.end_time END;
   IF entry_start IS NULL OR entry_start>clock_timestamp()+interval '5 minutes' OR entry_end<entry_start OR entry_end>clock_timestamp()+interval '5 minutes'
    OR item->'fields'->>'quality' NOT IN('good','medium','bad') OR length(item->'fields'->>'notes')>10000 THEN RETURN jsonb_build_object('status','invalid'); END IF;
  END IF;
 END LOOP;
 INSERT INTO sleep_sync_private.tickets VALUES(txid_current(),auth.uid());
 FOR item IN SELECT value FROM jsonb_array_elements(changes) LOOP
  action := item->>'action';
  IF action='delete' THEN DELETE FROM public.sleep_entries WHERE id=(item->>'id')::uuid; CONTINUE; END IF;
  IF action='create' THEN
   SELECT CASE WHEN count(*)=1 THEN (array_agg(p.uid))[1] ELSE NULL END INTO peer FROM (
    SELECT DISTINCT CASE WHEN l.creator_id=auth.uid() THEN l.invited_id ELSE l.creator_id END uid
    FROM public.account_links l WHERE l.status='accepted' AND l.relationship_type='partner'
     AND auth.uid() IN(l.creator_id,l.invited_id)
     AND EXISTS(SELECT 1 FROM public.baby_info b WHERE b.id=bid AND
      (b.user_id=CASE WHEN l.creator_id=auth.uid() THEN l.invited_id ELSE l.creator_id END
       OR EXISTS(SELECT 1 FROM public.baby_members m WHERE m.baby_id=bid AND m.role IN('parent','partner')
        AND m.user_id=CASE WHEN l.creator_id=auth.uid() THEN l.invited_id ELSE l.creator_id END)))
   ) p;
   INSERT INTO public.sleep_entries(user_id,baby_id,start_time,end_time,notes,quality,partner_id,updated_by,duration_minutes)
    VALUES(auth.uid(),bid,(item->'fields'->>'start_time')::timestamptz,(item->'fields'->>'end_time')::timestamptz,
     item->'fields'->>'notes',item->'fields'->>'quality',peer,auth.uid(),CASE WHEN item->'fields'->>'end_time' IS NOT NULL THEN
      round(extract(epoch FROM((item->'fields'->>'end_time')::timestamptz-(item->'fields'->>'start_time')::timestamptz))/60) END) RETURNING id INTO created;
   result_ids := result_ids || to_jsonb(created);
  ELSE
   SELECT * INTO e FROM public.sleep_entries WHERE id=(item->>'id')::uuid;
   entry_start := CASE WHEN item->'fields' ? 'start_time' THEN (item->'fields'->>'start_time')::timestamptz ELSE e.start_time END;
   entry_end := CASE WHEN item->'fields' ? 'end_time' THEN (item->'fields'->>'end_time')::timestamptz ELSE e.end_time END;
   UPDATE public.sleep_entries SET start_time=entry_start,end_time=entry_end,
    duration_minutes=CASE WHEN entry_end IS NOT NULL THEN round(extract(epoch FROM(entry_end-entry_start))/60) END,
    notes=CASE WHEN item->'fields' ? 'notes' THEN item->'fields'->>'notes' ELSE e.notes END,
    quality=CASE WHEN item->'fields' ? 'quality' THEN item->'fields'->>'quality' ELSE e.quality END,updated_by=auth.uid() WHERE id=e.id;
   result_ids := result_ids || to_jsonb(e.id);
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.sleep_entries WHERE baby_id=bid AND end_time IS NULL)>1 THEN RAISE EXCEPTION 'multiple_active_sleep_entries' USING ERRCODE='22023'; END IF;
 DELETE FROM sleep_sync_private.tickets WHERE transaction_id=txid_current();
 INSERT INTO sleep_sync_private.receipts(actor_id,operation_id,baby_id,payload_digest,outcome) VALUES(auth.uid(),op,bid,digest,'mutated');
 RETURN jsonb_build_object('status','applied','operationId',op,'entryIds',result_ids,'currentSnapshot',sleep_sync_private.snapshot(bid,NULL));
END $$;
CREATE FUNCTION public.sleep_sync_capability() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sleep_sync_private.capability() $$;
CREATE FUNCTION public.sleep_sync_snapshot(p_baby_id uuid,p_entry_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sleep_sync_private.snapshot(p_baby_id,p_entry_id) $$;
CREATE FUNCTION public.sleep_sync_stop(p_operation_id uuid,p_expected_actor uuid,p_baby_id uuid,p_entry_id uuid,p_expected_entry_revision bigint,p_expected_scope_revision bigint,
 p_stop_at timestamptz,p_quality text,p_notes text,p_change_quality boolean,p_change_notes boolean) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sleep_sync_private.commit_stop(p_operation_id,p_expected_actor,p_baby_id,p_entry_id,p_expected_entry_revision,p_expected_scope_revision,p_stop_at,p_quality,p_notes,p_change_quality,p_change_notes) $$;
CREATE FUNCTION public.sleep_sync_mutate(p_operation_id uuid,p_expected_actor uuid,p_baby_id uuid,p_expected_scope_revision bigint,p_changes jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sleep_sync_private.mutate(p_operation_id,p_expected_actor,p_baby_id,p_expected_scope_revision,p_changes) $$;
CREATE FUNCTION sleep_sync_private.keep_shared(expected_actor uuid,bid uuid,target uuid,expected_scope bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev bigint; current_snapshot jsonb;
BEGIN
 IF expected_actor IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 LOCK TABLE public.sleep_entries IN SHARE MODE;
 LOCK TABLE public.baby_info,public.baby_members,public.account_links,public.sleep_entry_shares,consent_private.decisions,consent_private.user_state,deletion_private.requests IN SHARE MODE;
 IF NOT sleep_sync_private.actor_allowed() OR NOT sleep_sync_private.baby_readable(bid) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
 SELECT revision INTO rev FROM sleep_sync_private.scopes WHERE baby_id=bid;
 current_snapshot := sleep_sync_private.snapshot(bid,target);
 IF current_snapshot->>'status'<>'available' THEN RETURN current_snapshot; END IF;
 IF coalesce(rev,0)<>expected_scope THEN RETURN jsonb_build_object('status','conflict','currentSnapshot',current_snapshot); END IF;
 RETURN jsonb_build_object('status','accepted','currentSnapshot',current_snapshot);
END $$;
CREATE FUNCTION public.sleep_sync_keep(p_expected_actor uuid,p_baby_id uuid,p_entry_id uuid,p_expected_scope_revision bigint) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sleep_sync_private.keep_shared(p_expected_actor,p_baby_id,p_entry_id,p_expected_scope_revision) $$;
CREATE FUNCTION sleep_sync_private.own_receipts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN sleep_sync_private.actor_allowed() THEN coalesce((SELECT jsonb_agg(jsonb_build_object('operationId',operation_id,'outcome',outcome,'committedAt',committed_at)) FROM sleep_sync_private.receipts WHERE actor_id=auth.uid()),'[]'::jsonb) ELSE '[]'::jsonb END
$$;
CREATE FUNCTION public.sleep_sync_receipts() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT sleep_sync_private.own_receipts() $$;
CREATE FUNCTION sleep_sync_private.withdraw_receipts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.scope='health' AND NEW.decision<>'granted' THEN DELETE FROM sleep_sync_private.receipts WHERE actor_id=NEW.user_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sleep_receipt_withdrawal AFTER INSERT OR UPDATE ON consent_private.decisions FOR EACH ROW EXECUTE FUNCTION sleep_sync_private.withdraw_receipts();
-- Required deletion/export inventory. This intentionally changes the readiness
-- fingerprint; deployment must refresh its approval separately.
INSERT INTO deletion_private.rules(schema_name,table_name,column_name,action)
 VALUES('sleep_sync_private','receipts','actor_id','delete');
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sleep_sync_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA sleep_sync_private TO authenticated;
GRANT EXECUTE ON FUNCTION sleep_sync_private.capability(),sleep_sync_private.snapshot(uuid,uuid),
 sleep_sync_private.commit_stop(uuid,uuid,uuid,uuid,bigint,bigint,timestamptz,text,text,boolean,boolean),
 sleep_sync_private.mutate(uuid,uuid,uuid,bigint,jsonb),sleep_sync_private.own_receipts(),sleep_sync_private.keep_shared(uuid,uuid,uuid,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.sleep_sync_capability(),public.sleep_sync_snapshot(uuid,uuid),
 public.sleep_sync_stop(uuid,uuid,uuid,uuid,bigint,bigint,timestamptz,text,text,boolean,boolean),
 public.sleep_sync_mutate(uuid,uuid,uuid,bigint,jsonb),public.sleep_sync_receipts(),public.sleep_sync_keep(uuid,uuid,uuid,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.sleep_sync_capability(),public.sleep_sync_snapshot(uuid,uuid),
 public.sleep_sync_stop(uuid,uuid,uuid,uuid,bigint,bigint,timestamptz,text,text,boolean,boolean),
 public.sleep_sync_mutate(uuid,uuid,uuid,bigint,jsonb),public.sleep_sync_receipts(),public.sleep_sync_keep(uuid,uuid,uuid,bigint) TO authenticated;
COMMIT;
