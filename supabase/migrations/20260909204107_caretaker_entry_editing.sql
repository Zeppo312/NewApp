-- Record guest authorship without changing parent ownership or granting table access.
-- Existing rows have no reliable guest author and are intentionally not backfilled.
BEGIN;
CREATE TABLE caretaker_private.entry_authors (
  grant_id uuid NOT NULL REFERENCES caretaker_private.grants(id) ON DELETE CASCADE,
  sleep_entry_id uuid UNIQUE REFERENCES public.sleep_entries(id) ON DELETE CASCADE,
  daily_entry_id uuid UNIQUE REFERENCES public.baby_care_entries(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(sleep_entry_id, daily_entry_id) = 1)
);
CREATE INDEX ON caretaker_private.entry_authors (grant_id);
ALTER TABLE caretaker_private.entry_authors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON caretaker_private.entry_authors FROM PUBLIC, anon, authenticated;

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
          notes, quality,
          (g.allow_entries AND start_time >= g.starts_at AND (end_time IS NULL OR end_time < g.ends_at) AND EXISTS (SELECT 1 FROM caretaker_private.entry_authors a WHERE a.grant_id = g.id AND a.sleep_entry_id = sleep_entries.id)) AS can_edit
        FROM public.sleep_entries WHERE baby_id = g.baby_id
          AND start_time >= visible_from AND start_time < g.ends_at AND start_time <= clock_timestamp()
      ) s),
      'daily', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.start_time DESC), '[]'::jsonb) FROM (
        SELECT id, entry_type, start_time, CASE WHEN end_time < g.ends_at THEN end_time ELSE NULL END AS end_time,
          notes, feeding_type, feeding_volume_ml, diaper_type,
          (g.allow_entries AND start_time >= g.starts_at AND (end_time IS NULL OR end_time < g.ends_at) AND EXISTS (SELECT 1 FROM caretaker_private.entry_authors a WHERE a.grant_id = g.id AND a.daily_entry_id = c.id)) AS can_edit,
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
    IF command IN ('sleep_update', 'sleep_delete') THEN
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
