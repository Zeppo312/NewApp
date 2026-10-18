-- Own activities are included in the existing whole-baby 'Our day' grant.
-- Custom activity and server entitlement schemas must be deployed before using these RPCs.
BEGIN;
CREATE FUNCTION caretaker_private.has_premium(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE profile record;
BEGIN
  SELECT is_admin, paywall_access_role INTO profile FROM public.profiles WHERE id = p_user_id;
  IF profile.is_admin IS TRUE OR profile.paywall_access_role = 'premium_tester' THEN RETURN true; END IF;
  IF profile.paywall_access_role IN ('lite_tester', 'tester', 'cooperation_partner') THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.lotti_subscription_entitlements
    WHERE user_id = p_user_id AND COALESCE(tier, CASE WHEN is_premium THEN 'premium' END) = 'premium'
      AND (expires_at IS NULL OR expires_at > now()));
END;
$$;
REVOKE ALL ON FUNCTION caretaker_private.has_premium(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION caretaker_private.access(p_action text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  g caretaker_private.grants%ROWTYPE;
  result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_action = 'create' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.baby_info b WHERE b.id = (p_payload->>'baby_id')::uuid
      AND (b.user_id = actor OR EXISTS (
        SELECT 1 FROM public.baby_members m
        WHERE m.baby_id = b.id AND m.user_id = actor AND m.role IN ('owner', 'parent')
      ))
    ) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    IF NOT caretaker_private.has_premium(actor) THEN RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501'; END IF;
    IF (p_payload->>'ends_at')::timestamptz <= now() THEN RAISE EXCEPTION 'invalid_period'; END IF;
    INSERT INTO caretaker_private.grants (baby_id, owner_id, label, starts_at, ends_at, history_days, allow_entries)
    VALUES ((p_payload->>'baby_id')::uuid, actor, trim(p_payload->>'label'),
      (p_payload->>'starts_at')::timestamptz, (p_payload->>'ends_at')::timestamptz,
      COALESCE((p_payload->>'history_days')::integer, 0), COALESCE((p_payload->>'allow_entries')::boolean, true))
    RETURNING * INTO g;
    RETURN to_jsonb(g) - 'guest_token_hash';
  ELSIF p_action = 'list' THEN
    SELECT COALESCE(jsonb_agg(
      (to_jsonb(x) - 'invitation_code' - 'guest_token_hash') || jsonb_build_object(
        'invitation_code', CASE WHEN x.owner_id = actor AND x.caregiver_id IS NULL AND x.guest_token_hash IS NULL AND x.revoked_at IS NULL AND x.ends_at > now() THEN x.invitation_code ELSE NULL END,
        'baby_name', b.name
      ) ORDER BY x.created_at DESC), '[]'::jsonb) INTO result
    FROM caretaker_private.grants x JOIN public.baby_info b ON b.id = x.baby_id
    WHERE x.owner_id = actor;
    RETURN result;
  END IF;
  IF p_action = 'revoke' THEN
    UPDATE caretaker_private.grants SET revoked_at = now()
    WHERE id = (p_payload->>'grant_id')::uuid AND owner_id = actor RETURNING * INTO g;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    RETURN '{}'::jsonb;
  END IF;
  RAISE EXCEPTION 'invalid_action' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION caretaker_private.guest_access(p_action text, p_payload jsonb, p_session_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g caretaker_private.grants%ROWTYPE;
  token_hash text;
  entry_id uuid;
  entry_start timestamptz;
  entry_end timestamptz;
  entry_quality text;
  source_type text;
  custom_definition record;
  custom_entry record;
  quantity numeric;
  visible_from timestamptz;
  command text;
BEGIN
  IF p_session_token IS NULL OR p_session_token !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_guest_session' USING ERRCODE = '42501';
  END IF;
  token_hash := encode(sha256(convert_to(p_session_token, 'UTF8')), 'hex');
  IF p_action = 'accept' THEN
    SELECT * INTO g FROM caretaker_private.grants
    WHERE invitation_code = lower(regexp_replace(p_payload->>'code', '[\s-]', '', 'g')) FOR UPDATE;
    IF NOT FOUND OR g.revoked_at IS NOT NULL OR clock_timestamp() >= g.ends_at
      OR g.caregiver_id IS NOT NULL
      OR (g.guest_token_hash IS NOT NULL AND g.guest_token_hash <> token_hash)
    THEN RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '42501'; END IF;
    IF NOT caretaker_private.has_premium(g.owner_id) THEN RAISE EXCEPTION 'access_inactive' USING ERRCODE = '42501'; END IF;
    -- A retry with the same client-generated token recovers a lost response.
    UPDATE caretaker_private.grants SET guest_token_hash = token_hash,
      accepted_at = COALESCE(accepted_at, clock_timestamp()) WHERE id = g.id;
    RETURN jsonb_build_object('id', g.id);
  END IF;
  IF p_action NOT IN ('read', 'write') OR p_action IS NULL THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM caretaker_private.grants WHERE guest_token_hash = token_hash FOR UPDATE;
  IF NOT FOUND OR (p_payload->>'grant_id' IS NOT NULL AND g.id <> (p_payload->>'grant_id')::uuid) THEN
    RAISE EXCEPTION 'invalid_guest_session' USING ERRCODE = '42501';
  END IF;
  IF g.revoked_at IS NOT NULL OR clock_timestamp() < g.starts_at OR clock_timestamp() >= g.ends_at THEN
    RAISE EXCEPTION 'access_inactive' USING ERRCODE = '42501';
  END IF;
  IF NOT caretaker_private.has_premium(g.owner_id) THEN RAISE EXCEPTION 'access_inactive' USING ERRCODE = '42501'; END IF;
  -- A parent who lost access cannot leave an indirect grant behind.
  IF NOT EXISTS (
    SELECT 1 FROM public.baby_info b WHERE b.id = g.baby_id
      AND (b.user_id = g.owner_id OR EXISTS (
        SELECT 1 FROM public.baby_members m WHERE m.baby_id = b.id
          AND m.user_id = g.owner_id AND m.role IN ('owner', 'parent')
      ))
  ) THEN RAISE EXCEPTION 'access_inactive' USING ERRCODE = '42501'; END IF;
  visible_from := g.starts_at - g.history_days * interval '24 hours';

  IF p_action = 'read' THEN
    RETURN jsonb_build_object(
      'server_now', clock_timestamp(), 'starts_at', g.starts_at, 'ends_at', g.ends_at,
      'visible_from', visible_from, 'allow_entries', g.allow_entries,
      'baby_name', (SELECT name FROM public.baby_info WHERE id = g.baby_id),
      'custom_activities', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.name), '[]'::jsonb) FROM (
        SELECT id, name, emoji, color, tracking_mode, unit, default_quantity
        FROM public.custom_activity_types WHERE baby_id = g.baby_id AND NOT is_archived
      ) a),
      'sleep', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.start_time DESC), '[]'::jsonb) FROM (
        SELECT id, start_time, CASE WHEN end_time < g.ends_at THEN end_time ELSE NULL END AS end_time,
          notes, quality,
          (g.allow_entries AND start_time >= g.starts_at AND (end_time IS NULL OR end_time < g.ends_at) AND EXISTS (SELECT 1 FROM caretaker_private.entry_authors a WHERE a.grant_id = g.id AND a.sleep_entry_id = sleep_entries.id)) AS can_edit
        FROM public.sleep_entries WHERE baby_id = g.baby_id
          AND start_time >= visible_from AND start_time < g.ends_at AND start_time <= clock_timestamp()
      ) s),
      'daily', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.start_time DESC), '[]'::jsonb) FROM (
        SELECT id, entry_type, start_time, CASE WHEN end_time < g.ends_at THEN end_time ELSE NULL END AS end_time,
          notes, feeding_type, feeding_volume_ml, diaper_type,
          (g.allow_entries AND start_time >= g.starts_at AND (end_time IS NULL OR end_time < g.ends_at) AND EXISTS (SELECT 1 FROM caretaker_private.entry_authors a WHERE a.grant_id = g.id AND a.daily_entry_id = c.id)) AS can_edit,
          c.custom_activity_type_id, c.custom_color, c.custom_tracking_mode,
          to_jsonb(c)->>'custom_name' AS custom_name,
          to_jsonb(c)->>'custom_emoji' AS custom_emoji,
          to_jsonb(c)->>'custom_quantity' AS custom_quantity,
          to_jsonb(c)->>'custom_unit' AS custom_unit
        FROM public.baby_care_entries c WHERE baby_id = g.baby_id
          AND start_time >= visible_from AND start_time < g.ends_at AND start_time <= clock_timestamp()
      ) d)
    );
  ELSIF p_action = 'write' THEN
    IF NOT g.allow_entries THEN RAISE EXCEPTION 'read_only' USING ERRCODE = '42501'; END IF;
    command := p_payload->>'command';
    IF length(COALESCE(p_payload->>'notes', '')) > 1000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
    -- Serialize concurrent caregivers of the same baby (e.g. two sleep starts).
    PERFORM 1 FROM public.baby_info WHERE id = g.baby_id FOR UPDATE;
    entry_start := COALESCE((p_payload->>'start_time')::timestamptz, clock_timestamp());
    entry_end := (p_payload->>'end_time')::timestamptz;
    entry_quality := NULLIF(p_payload->>'quality', '');
    IF NOT isfinite(entry_start) OR entry_start < g.starts_at OR entry_start >= g.ends_at OR entry_start > clock_timestamp()
      OR (entry_end IS NOT NULL AND (NOT isfinite(entry_end) OR entry_end < entry_start OR entry_end >= g.ends_at OR entry_end > clock_timestamp()))
    THEN RAISE EXCEPTION 'invalid_entry_period' USING ERRCODE = '42501'; END IF;
    IF entry_quality IS NOT NULL AND entry_quality NOT IN ('good', 'medium', 'bad') THEN RAISE EXCEPTION 'invalid_quality'; END IF;
    IF command IN ('custom', 'custom_update') THEN
      IF command = 'custom_update' THEN
        SELECT e.* INTO custom_entry FROM public.baby_care_entries e
        JOIN caretaker_private.entry_authors a ON a.daily_entry_id = e.id AND a.grant_id = g.id
        WHERE e.id = (p_payload->>'entry_id')::uuid AND e.baby_id = g.baby_id AND e.entry_type = 'custom'
          AND e.start_time >= g.starts_at AND e.start_time < g.ends_at AND e.start_time <= clock_timestamp()
          AND (e.end_time IS NULL OR e.end_time < g.ends_at) FOR UPDATE OF e;
        IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_editable' USING ERRCODE = '42501'; END IF;
        IF p_payload->>'start_time' IS NULL THEN RAISE EXCEPTION 'invalid_entry_period'; END IF;
        -- Keep the original snapshot, even if parents renamed or archived the definition.
        SELECT custom_entry.custom_name AS name, custom_entry.custom_emoji AS emoji,
          custom_entry.custom_color AS color, custom_entry.custom_tracking_mode AS tracking_mode,
          custom_entry.custom_unit AS unit INTO custom_definition;
      ELSE
        SELECT id, name, emoji, color, tracking_mode, unit INTO custom_definition
        FROM public.custom_activity_types WHERE id = (p_payload->>'custom_activity_type_id')::uuid
          AND baby_id = g.baby_id AND NOT is_archived FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'activity_not_available' USING ERRCODE = '42501'; END IF;
      END IF;
      quantity := NULL;
      IF custom_definition.tracking_mode = 'quantity' THEN
        quantity := (p_payload->>'custom_quantity')::numeric;
        IF quantity IS NULL OR NOT (quantity BETWEEN 0.001 AND 999999999.999)
        THEN RAISE EXCEPTION 'invalid_quantity'; END IF;
      END IF;
      IF custom_definition.tracking_mode <> 'duration' THEN entry_end := entry_start; END IF;
      IF command = 'custom_update' THEN
        UPDATE public.baby_care_entries SET start_time = entry_start, end_time = entry_end,
          notes = NULLIF(trim(p_payload->>'notes'), ''), custom_quantity = quantity WHERE id = custom_entry.id;
        entry_id := custom_entry.id;
      ELSE
        INSERT INTO public.baby_care_entries (baby_id, user_id, entry_type, start_time, end_time, notes,
          custom_activity_type_id, custom_name, custom_emoji, custom_color, custom_tracking_mode, custom_quantity, custom_unit)
        VALUES (g.baby_id, g.owner_id, 'custom', entry_start, entry_end, NULLIF(trim(p_payload->>'notes'), ''),
          custom_definition.id, custom_definition.name, custom_definition.emoji, custom_definition.color,
          custom_definition.tracking_mode, quantity, custom_definition.unit) RETURNING id INTO entry_id;
        INSERT INTO caretaker_private.entry_authors (grant_id, daily_entry_id) VALUES (g.id, entry_id);
      END IF;
    ELSIF command IN ('sleep_update', 'sleep_delete') THEN
      SELECT e.id INTO entry_id FROM public.sleep_entries e
      JOIN caretaker_private.entry_authors a ON a.sleep_entry_id = e.id AND a.grant_id = g.id
      WHERE e.id = (p_payload->>'entry_id')::uuid AND e.baby_id = g.baby_id
        AND e.start_time >= g.starts_at AND e.start_time < g.ends_at AND e.start_time <= clock_timestamp()
        AND (e.end_time IS NULL OR e.end_time < g.ends_at) FOR UPDATE OF e;
      IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_editable' USING ERRCODE = '42501'; END IF;
      IF command = 'sleep_delete' THEN
        DELETE FROM public.sleep_entries WHERE id = entry_id;
      ELSE
        IF p_payload->>'start_time' IS NULL THEN RAISE EXCEPTION 'invalid_entry_period'; END IF;
        IF entry_end IS NULL AND EXISTS (SELECT 1 FROM public.sleep_entries WHERE baby_id = g.baby_id AND end_time IS NULL AND id <> entry_id)
        THEN RAISE EXCEPTION 'sleep_already_running'; END IF;
        UPDATE public.sleep_entries SET start_time = entry_start, end_time = entry_end,
          duration_minutes = CASE WHEN entry_end IS NOT NULL THEN floor(extract(epoch FROM (entry_end - entry_start))/60)::integer END,
          quality = entry_quality, notes = NULLIF(trim(p_payload->>'notes'), ''), updated_at = clock_timestamp()
        WHERE id = entry_id;
      END IF;
    ELSIF command IN ('daily_update', 'daily_delete') THEN
      SELECT e.id, e.entry_type INTO entry_id, source_type FROM public.baby_care_entries e
      JOIN caretaker_private.entry_authors a ON a.daily_entry_id = e.id AND a.grant_id = g.id
      WHERE e.id = (p_payload->>'entry_id')::uuid AND e.baby_id = g.baby_id
        AND e.start_time >= g.starts_at AND e.start_time < g.ends_at AND e.start_time <= clock_timestamp()
        AND (e.end_time IS NULL OR e.end_time < g.ends_at) FOR UPDATE OF e;
      IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_editable' USING ERRCODE = '42501'; END IF;
      IF command = 'daily_delete' THEN
        DELETE FROM public.baby_care_entries WHERE id = entry_id;
      ELSE
        IF p_payload->>'start_time' IS NULL THEN RAISE EXCEPTION 'invalid_entry_period'; END IF;
        IF source_type NOT IN ('feeding', 'diaper') OR p_payload->>'entry_type' IS DISTINCT FROM source_type
          OR (source_type = 'feeding' AND COALESCE(p_payload->>'feeding_type', '') NOT IN ('BOTTLE', 'SOLIDS'))
          OR (source_type = 'diaper' AND COALESCE(p_payload->>'diaper_type', '') NOT IN ('WET', 'DIRTY', 'BOTH'))
        THEN RAISE EXCEPTION 'invalid_command'; END IF;
        IF source_type = 'feeding' AND p_payload->>'feeding_type' = 'BOTTLE'
          AND ((p_payload->>'volume_ml') IS NULL OR (p_payload->>'volume_ml')::integer NOT BETWEEN 1 AND 2000) THEN RAISE EXCEPTION 'invalid_volume'; END IF;
        UPDATE public.baby_care_entries SET start_time = entry_start, end_time = COALESCE(entry_end, entry_start),
          notes = NULLIF(trim(p_payload->>'notes'), ''),
          feeding_type = CASE WHEN source_type = 'feeding' THEN p_payload->>'feeding_type' END,
          feeding_volume_ml = CASE WHEN source_type = 'feeding' AND p_payload->>'feeding_type' = 'BOTTLE' THEN (p_payload->>'volume_ml')::integer END,
          diaper_type = CASE WHEN source_type = 'diaper' THEN p_payload->>'diaper_type' END
        WHERE id = entry_id;
      END IF;
    ELSIF command IN ('sleep_start', 'sleep_add') THEN
      IF command = 'sleep_start' THEN entry_start := clock_timestamp(); entry_end := NULL; END IF;
      IF entry_end IS NULL AND EXISTS (SELECT 1 FROM public.sleep_entries WHERE baby_id = g.baby_id AND end_time IS NULL)
      THEN RAISE EXCEPTION 'sleep_already_running'; END IF;
      -- Support both deployed sleep schemas; created_by is absent on the current project.
      IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.sleep_entries'::regclass AND attname = 'created_by' AND NOT attisdropped) THEN
        INSERT INTO public.sleep_entries (baby_id, user_id, created_by, start_time, end_time, duration_minutes, quality, notes)
        VALUES (g.baby_id, g.owner_id, g.owner_id, entry_start, entry_end,
          CASE WHEN entry_end IS NOT NULL THEN floor(extract(epoch FROM (entry_end - entry_start))/60)::integer END,
          entry_quality, NULLIF(trim(p_payload->>'notes'), '')) RETURNING id INTO entry_id;
      ELSE
        INSERT INTO public.sleep_entries (baby_id, user_id, start_time, end_time, duration_minutes, quality, notes)
        VALUES (g.baby_id, g.owner_id, entry_start, entry_end,
          CASE WHEN entry_end IS NOT NULL THEN floor(extract(epoch FROM (entry_end - entry_start))/60)::integer END,
          entry_quality, NULLIF(trim(p_payload->>'notes'), '')) RETURNING id INTO entry_id;
      END IF;
      INSERT INTO caretaker_private.entry_authors (grant_id, sleep_entry_id) VALUES (g.id, entry_id);
    ELSIF command = 'sleep_stop' THEN
      SELECT id, start_time INTO entry_id, entry_start FROM public.sleep_entries
      WHERE id = (p_payload->>'entry_id')::uuid AND baby_id = g.baby_id
        AND start_time >= g.starts_at AND start_time <= clock_timestamp() AND end_time IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_editable' USING ERRCODE = '42501'; END IF;
      UPDATE public.sleep_entries SET end_time = clock_timestamp(),
        duration_minutes = greatest(0, floor(extract(epoch FROM (clock_timestamp() - entry_start)) / 60))::integer,
        updated_at = clock_timestamp() WHERE id = entry_id;
    ELSIF command IN ('bottle', 'solids', 'diaper_wet', 'diaper_dirty', 'diaper_both') THEN
      IF command = 'bottle' AND ((p_payload->>'volume_ml') IS NULL OR (p_payload->>'volume_ml')::integer NOT BETWEEN 1 AND 2000) THEN RAISE EXCEPTION 'invalid_volume'; END IF;
      INSERT INTO public.baby_care_entries (baby_id, user_id, entry_type, start_time, end_time, notes, feeding_type, feeding_volume_ml, diaper_type)
      VALUES (g.baby_id, g.owner_id, CASE WHEN command IN ('bottle', 'solids') THEN 'feeding' ELSE 'diaper' END,
        entry_start, COALESCE(entry_end, entry_start), NULLIF(trim(p_payload->>'notes'), ''),
        CASE command WHEN 'bottle' THEN 'BOTTLE' WHEN 'solids' THEN 'SOLIDS' END,
        CASE WHEN command = 'bottle' THEN (p_payload->>'volume_ml')::integer END,
        CASE command WHEN 'diaper_wet' THEN 'WET' WHEN 'diaper_dirty' THEN 'DIRTY' WHEN 'diaper_both' THEN 'BOTH' END)
      RETURNING id INTO entry_id;
      INSERT INTO caretaker_private.entry_authors (grant_id, daily_entry_id) VALUES (g.id, entry_id);
    ELSE RAISE EXCEPTION 'invalid_command'; END IF;
    -- Roll the entire write back if the grant expired while waiting for locks.
    IF clock_timestamp() >= g.ends_at THEN RAISE EXCEPTION 'access_inactive' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('id', entry_id);
  END IF;
  RAISE EXCEPTION 'invalid_action';
END;
$$;
COMMIT;
