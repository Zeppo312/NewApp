-- Additive endpoint for local-first tracking. Existing writers and the gated
-- versioned sleep package remain unchanged. All domain access uses existing RLS.
BEGIN;
CREATE TABLE public.tracking_sync_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  baby_id uuid NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('care','sleep','vitamin')),
  entry_id uuid,
  request_hash text NOT NULL,
  result_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,operation_id)
);
ALTER TABLE public.tracking_sync_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracking_sync_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.tracking_sync_receipts TO authenticated;
CREATE POLICY own_tracking_receipts ON public.tracking_sync_receipts TO authenticated
  USING (user_id=(SELECT auth.uid()) AND consent_private.family_allowed((SELECT auth.uid()),'health'))
  WITH CHECK (user_id=(SELECT auth.uid()) AND consent_private.family_allowed((SELECT auth.uid()),'health'));
CREATE TRIGGER account_deletion_guard BEFORE INSERT OR UPDATE ON public.tracking_sync_receipts
  FOR EACH ROW EXECUTE FUNCTION deletion_private.guard_write();

CREATE FUNCTION public.tracking_sync_operation(
  p_expected_actor uuid,p_operation_id uuid,p_baby_id uuid,p_kind text,p_action text,
  p_entry_id uuid,p_fields jsonb,p_expected_updated_at timestamptz DEFAULT NULL,p_inventory_item_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  actor uuid := auth.uid(); digest text; previous public.tracking_sync_receipts;
  care public.baby_care_entries; sleeper public.sleep_entries; clean jsonb; result jsonb;
  stock public.inventory_items; demand numeric; before_total numeric; after_total numeric;
  opened integer; next_current numeric; next_sealed integer; target_category text;
  partner uuid; owner uuid;
BEGIN
  IF actor IS NULL OR actor<>p_expected_actor THEN RAISE EXCEPTION 'Tracking actor changed' USING ERRCODE='42501'; END IF;
  IF NOT consent_private.family_allowed(actor,'health') THEN RAISE EXCEPTION 'Health consent required' USING ERRCODE='42501'; END IF;
  -- Only a currently accessible child can receive new work or expose a receipt.
  SELECT user_id INTO owner FROM public.baby_info WHERE id=p_baby_id;
  IF owner IS NULL THEN RETURN jsonb_build_object('status','forbidden','operationId',p_operation_id); END IF;
  IF p_kind NOT IN ('care','sleep','vitamin') OR p_action NOT IN ('create','update','delete','check')
     OR p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR p_operation_id IS NULL
     OR p_kind<>'vitamin' AND p_entry_id IS NULL THEN RAISE EXCEPTION 'Invalid tracking operation' USING ERRCODE='22023'; END IF;
  digest := md5(jsonb_build_object('baby',p_baby_id,'kind',p_kind,'action',p_action,'entry',p_entry_id,
    'fields',p_fields,'base',p_expected_updated_at,'inventory',p_inventory_item_id)::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||p_operation_id::text,0));
  SELECT * INTO previous FROM public.tracking_sync_receipts WHERE user_id=actor AND operation_id=p_operation_id;
  IF FOUND THEN
    IF previous.request_hash<>digest THEN RAISE EXCEPTION 'Operation payload changed' USING ERRCODE='22023'; END IF;
    IF p_kind='care' THEN SELECT to_jsonb(e) INTO result FROM public.baby_care_entries e WHERE id=p_entry_id AND baby_id=p_baby_id;
    ELSIF p_kind='sleep' THEN SELECT to_jsonb(e) INTO result FROM public.sleep_entries e WHERE id=p_entry_id AND baby_id=p_baby_id;
    END IF;
    -- Receipt proves execution even if a partner edited/deleted the entry later.
    RETURN jsonb_build_object('status','already_applied','operationId',p_operation_id,'row',result,'appliedUpdatedAt',previous.result_updated_at);
  END IF;

  IF p_kind='care' THEN
    IF p_action NOT IN ('create','update','delete') THEN RAISE EXCEPTION 'Invalid care action' USING ERRCODE='22023'; END IF;
    SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO clean FROM jsonb_each(p_fields)
      WHERE key=ANY(ARRAY['entry_type','start_time','end_time','notes','feeding_type','feeding_volume_ml','feeding_side',
        'diaper_type','diaper_fever_measured','diaper_temperature_c','diaper_suppository_given','diaper_suppository_dose_mg',
        'custom_activity_type_id','custom_name','custom_emoji','custom_color','custom_tracking_mode','custom_quantity','custom_unit']);
    IF p_action='create' THEN
      care := jsonb_populate_record(NULL::public.baby_care_entries,clean||jsonb_build_object('id',p_entry_id,'user_id',actor,'baby_id',p_baby_id,'created_at',now(),'updated_at',now()));
      INSERT INTO public.baby_care_entries SELECT care.* RETURNING * INTO care;
      -- Entry, stock change, audit and receipt commit in one transaction.
      target_category := CASE WHEN care.entry_type='diaper' THEN 'diapers' WHEN care.feeding_type='BOTTLE' AND care.feeding_volume_ml>0 AND p_inventory_item_id IS DISTINCT FROM 'none' THEN 'formula' END;
      IF target_category IS NOT NULL THEN
        SELECT * INTO stock FROM public.inventory_items
          WHERE category=target_category AND (target_category<>'formula' OR dosage_grams_per_100ml>0)
            AND (p_inventory_item_id IS NULL OR id::text=p_inventory_item_id)
          ORDER BY (current_quantity+coalesce(packages_sealed,0)*coalesce(package_quantity,0)>0) DESC,created_at,id LIMIT 1 FOR UPDATE;
        IF FOUND THEN
          demand := CASE WHEN target_category='diapers' THEN 1 ELSE round(care.feeding_volume_ml::numeric/100*stock.dosage_grams_per_100ml,1) END;
          before_total := stock.current_quantity+coalesce(stock.packages_sealed,0)*coalesce(stock.package_quantity,0);
          IF before_total>0 AND demand>0 THEN
            opened := CASE WHEN stock.package_quantity>0 THEN least(coalesce(stock.packages_sealed,0),ceil(greatest(0,demand-stock.current_quantity)/stock.package_quantity)::integer) ELSE 0 END;
            next_sealed := coalesce(stock.packages_sealed,0)-opened;
            next_current := round(greatest(0,stock.current_quantity+opened*coalesce(stock.package_quantity,0)-demand),2);
            after_total := next_current+next_sealed*coalesce(stock.package_quantity,0);
            UPDATE public.inventory_items SET current_quantity=next_current,packages_sealed=next_sealed WHERE id=stock.id;
            IF NOT FOUND THEN RAISE EXCEPTION 'Inventory access changed' USING ERRCODE='42501'; END IF;
            INSERT INTO public.inventory_transactions(id,inventory_item_id,baby_id,created_by,transaction_type,quantity_change,quantity_after,note)
              VALUES(p_operation_id,stock.id,p_baby_id,actor,'usage',after_total-before_total,after_total,
                CASE WHEN target_category='diapers' THEN 'Wickeleintrag aus Unser Tag' ELSE 'Fläschchen '||care.feeding_volume_ml||' ml' END);
          END IF;
        END IF;
      END IF;
    ELSE
      SELECT * INTO care FROM public.baby_care_entries WHERE id=p_entry_id AND baby_id=p_baby_id FOR UPDATE;
      IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden','operationId',p_operation_id); END IF;
      IF p_expected_updated_at IS NULL OR care.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('status','conflict','operationId',p_operation_id,'reason','conflict','row',to_jsonb(care)); END IF;
      IF p_action='delete' THEN DELETE FROM public.baby_care_entries WHERE id=p_entry_id;
      ELSE
        care := jsonb_populate_record(care,clean);
        UPDATE public.baby_care_entries SET start_time=care.start_time,end_time=care.end_time,notes=care.notes,
          feeding_type=care.feeding_type,feeding_volume_ml=care.feeding_volume_ml,feeding_side=care.feeding_side,
          diaper_type=care.diaper_type,diaper_fever_measured=care.diaper_fever_measured,diaper_temperature_c=care.diaper_temperature_c,
          diaper_suppository_given=care.diaper_suppository_given,diaper_suppository_dose_mg=care.diaper_suppository_dose_mg,
          custom_activity_type_id=care.custom_activity_type_id,custom_name=care.custom_name,custom_emoji=care.custom_emoji,
          custom_color=care.custom_color,custom_tracking_mode=care.custom_tracking_mode,custom_quantity=care.custom_quantity,custom_unit=care.custom_unit
          WHERE id=p_entry_id RETURNING * INTO care;
      END IF;
      IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden','operationId',p_operation_id); END IF;
    END IF;
    result := CASE WHEN p_action='delete' THEN NULL ELSE to_jsonb(care) END;
  ELSIF p_kind='sleep' THEN
    IF p_action NOT IN ('create','update','delete') THEN RAISE EXCEPTION 'Invalid sleep action' USING ERRCODE='22023'; END IF;
    SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO clean FROM jsonb_each(p_fields)
      WHERE key=ANY(ARRAY['start_time','end_time','duration_minutes','quality','notes']);
    -- Excludes even legacy starts while the active-sleep check and insert commit.
    LOCK TABLE public.sleep_entries IN SHARE ROW EXCLUSIVE MODE;
    IF p_action='create' THEN
      IF (clean->>'end_time') IS NULL AND EXISTS(SELECT 1 FROM public.sleep_entries WHERE baby_id=p_baby_id AND end_time IS NULL AND start_time>now()-interval '24 hours') THEN
        RETURN jsonb_build_object('status','conflict','operationId',p_operation_id,'reason','active_sleep'); END IF;
      SELECT CASE WHEN creator_id=actor THEN invited_id ELSE creator_id END INTO partner FROM public.account_links
        WHERE status='accepted' AND relationship_type='partner' AND actor IN(creator_id,invited_id) LIMIT 1;
      sleeper := jsonb_populate_record(NULL::public.sleep_entries,clean||jsonb_build_object('id',p_entry_id,'user_id',actor,'baby_id',p_baby_id,'partner_id',partner,'created_at',now(),'updated_at',now()));
      INSERT INTO public.sleep_entries SELECT sleeper.* RETURNING * INTO sleeper;
    ELSE
      SELECT * INTO sleeper FROM public.sleep_entries WHERE id=p_entry_id AND baby_id=p_baby_id FOR UPDATE;
      IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden','operationId',p_operation_id); END IF;
      IF p_expected_updated_at IS NULL OR sleeper.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RETURN jsonb_build_object('status','conflict','operationId',p_operation_id,'reason','conflict','row',to_jsonb(sleeper)); END IF;
      IF p_action='delete' THEN DELETE FROM public.sleep_entries WHERE id=p_entry_id;
      ELSE
        sleeper := jsonb_populate_record(sleeper,clean);
        IF sleeper.end_time IS NOT NULL THEN sleeper.duration_minutes := greatest(0,round(extract(epoch FROM sleeper.end_time-sleeper.start_time)/60)::integer); END IF;
        UPDATE public.sleep_entries SET start_time=sleeper.start_time,end_time=sleeper.end_time,duration_minutes=sleeper.duration_minutes,quality=sleeper.quality,notes=sleeper.notes,updated_by=actor
          WHERE id=p_entry_id RETURNING * INTO sleeper;
      END IF;
      IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden','operationId',p_operation_id); END IF;
    END IF;
    result := CASE WHEN p_action='delete' THEN NULL ELSE to_jsonb(sleeper) END;
  ELSE
    IF p_action<>'check' OR (p_fields->>'day') !~ '^\d{4}-\d{2}-\d{2}$' OR jsonb_typeof(p_fields->'completed')<>'boolean' THEN RAISE EXCEPTION 'Invalid habit' USING ERRCODE='22023'; END IF;
    IF (p_fields->>'completed')::boolean THEN
      INSERT INTO public.baby_daily_habit_checks(baby_id,habit_key,day,checked_at,checked_by)
        VALUES(p_baby_id,'vitamin_d',(p_fields->>'day')::date,(p_fields->>'checked_at')::timestamptz,actor)
        ON CONFLICT(baby_id,habit_key,day) DO UPDATE SET checked_at=excluded.checked_at,checked_by=excluded.checked_by;
    ELSE DELETE FROM public.baby_daily_habit_checks WHERE baby_id=p_baby_id AND habit_key='vitamin_d' AND day=(p_fields->>'day')::date;
    END IF;
  END IF;
  INSERT INTO public.tracking_sync_receipts(user_id,operation_id,baby_id,kind,entry_id,request_hash,result_updated_at)
    VALUES(actor,p_operation_id,p_baby_id,p_kind,p_entry_id,digest,(result->>'updated_at')::timestamptz);
  RETURN jsonb_build_object('status','applied','operationId',p_operation_id,'row',result,'appliedUpdatedAt',result->>'updated_at');
END $$;
REVOKE ALL ON FUNCTION public.tracking_sync_operation(uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tracking_sync_operation(uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz,text) TO authenticated;

CREATE FUNCTION public.clear_tracking_receipts_on_withdrawal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.scope='health' AND NEW.decision<>'granted' THEN DELETE FROM public.tracking_sync_receipts WHERE user_id=NEW.user_id; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.clear_tracking_receipts_on_withdrawal() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tracking_receipt_withdrawal AFTER INSERT OR UPDATE ON consent_private.decisions
  FOR EACH ROW EXECUTE FUNCTION public.clear_tracking_receipts_on_withdrawal();
INSERT INTO deletion_private.rules(schema_name,table_name,column_name,action)
  VALUES('public','tracking_sync_receipts','user_id','delete');
-- The live schema already publishes sleep and vitamin checks. Care changes must
-- also wake the partner's authorized snapshot read while Unser Tag is open.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='baby_care_entries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.baby_care_entries;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
