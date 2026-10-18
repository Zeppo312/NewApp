-- Shared tracker inputs: bounded entry times and compatibility with the deployed sleep schema.
BEGIN;
CREATE OR REPLACE FUNCTION caretaker_private.guest_access(p_action text, p_payload jsonb, p_session_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g caretaker_private.grants%ROWTYPE;
  token_hash text;
  entry_id uuid;
  entry_start timestamptz;
  entry_end timestamptz;
  entry_quality text;
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
      'sleep', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.start_time DESC), '[]'::jsonb) FROM (
        SELECT id, start_time, CASE WHEN end_time < g.ends_at THEN end_time ELSE NULL END AS end_time,
          notes
        FROM public.sleep_entries WHERE baby_id = g.baby_id
          AND start_time >= visible_from AND start_time < g.ends_at AND start_time <= clock_timestamp()
      ) s),
      'daily', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.start_time DESC), '[]'::jsonb) FROM (
        SELECT id, entry_type, start_time, CASE WHEN end_time < g.ends_at THEN end_time ELSE NULL END AS end_time,
          notes, feeding_type, feeding_volume_ml, diaper_type,
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
    IF command IN ('sleep_start', 'sleep_add') THEN
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
    ELSE RAISE EXCEPTION 'invalid_command'; END IF;
    -- Roll the entire write back if the grant expired while waiting for locks.
    IF clock_timestamp() >= g.ends_at THEN RAISE EXCEPTION 'access_inactive' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('id', entry_id);
  END IF;
  RAISE EXCEPTION 'invalid_action';
END;
$$;
COMMIT;
