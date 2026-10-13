-- Temporary caregiving never creates account_links or baby_members.
-- This migration requires the existing multi-baby schema (baby_id columns).
BEGIN;
CREATE SCHEMA IF NOT EXISTS caretaker_private;
REVOKE ALL ON SCHEMA caretaker_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA caretaker_private TO authenticated;

CREATE TABLE caretaker_private.grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id uuid NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  invitation_code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  starts_at timestamptz NOT NULL CHECK (isfinite(starts_at)),
  ends_at timestamptz NOT NULL CHECK (isfinite(ends_at)),
  history_days integer NOT NULL DEFAULT 0 CHECK (history_days BETWEEN 0 AND 2),
  allow_entries boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (caregiver_id IS NULL OR caregiver_id <> owner_id)
);
ALTER TABLE caretaker_private.grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON caretaker_private.grants FROM PUBLIC, anon, authenticated;
CREATE INDEX ON caretaker_private.grants (owner_id);
CREATE INDEX ON caretaker_private.grants (caregiver_id, ends_at);

-- Narrow, authenticated gateway. The definer is intentionally confined to a
-- non-exposed schema: caregivers receive no direct access to source tables.
CREATE FUNCTION caretaker_private.access(p_action text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  g caretaker_private.grants%ROWTYPE;
  result jsonb;
  entry_id uuid;
  entry_start timestamptz;
  visible_from timestamptz;
  command text;
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
    IF (p_payload->>'ends_at')::timestamptz <= now() THEN RAISE EXCEPTION 'invalid_period'; END IF;
    INSERT INTO caretaker_private.grants (baby_id, owner_id, label, starts_at, ends_at, history_days, allow_entries)
    VALUES ((p_payload->>'baby_id')::uuid, actor, trim(p_payload->>'label'),
      (p_payload->>'starts_at')::timestamptz, (p_payload->>'ends_at')::timestamptz,
      COALESCE((p_payload->>'history_days')::integer, 0), COALESCE((p_payload->>'allow_entries')::boolean, true))
    RETURNING * INTO g;
    RETURN to_jsonb(g);
  ELSIF p_action = 'list' THEN
    SELECT COALESCE(jsonb_agg(
      (to_jsonb(x) - 'invitation_code') || jsonb_build_object(
        'invitation_code', CASE WHEN x.owner_id = actor AND x.caregiver_id IS NULL AND x.revoked_at IS NULL AND x.ends_at > now() THEN x.invitation_code ELSE NULL END,
        'baby_name', b.name
      ) ORDER BY x.created_at DESC), '[]'::jsonb) INTO result
    FROM caretaker_private.grants x JOIN public.baby_info b ON b.id = x.baby_id
    WHERE x.owner_id = actor OR x.caregiver_id = actor;
    RETURN result;
  ELSIF p_action = 'accept' THEN
    SELECT * INTO g FROM caretaker_private.grants
    WHERE invitation_code = lower(regexp_replace(p_payload->>'code', '[\s-]', '', 'g'))
    FOR UPDATE;
    IF NOT FOUND OR g.revoked_at IS NOT NULL OR g.ends_at <= now() OR g.owner_id = actor
      OR (g.caregiver_id IS NOT NULL AND g.caregiver_id <> actor)
    THEN RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '42501'; END IF;
    UPDATE caretaker_private.grants SET caregiver_id = actor WHERE id = g.id;
    RETURN jsonb_build_object('id', g.id);
  END IF;

  -- Row locking serializes writes and revocation. Time is checked on the server.
  SELECT * INTO g FROM caretaker_private.grants WHERE id = (p_payload->>'grant_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF p_action = 'revoke' THEN
    IF g.owner_id <> actor THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
    UPDATE caretaker_private.grants SET revoked_at = now() WHERE id = g.id;
    RETURN '{}'::jsonb;
  END IF;
  IF g.caregiver_id IS DISTINCT FROM actor OR g.revoked_at IS NOT NULL
    OR clock_timestamp() < g.starts_at OR clock_timestamp() >= g.ends_at
  THEN RAISE EXCEPTION 'access_inactive' USING ERRCODE = '42501'; END IF;
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
    IF command = 'sleep_start' THEN
      IF EXISTS (SELECT 1 FROM public.sleep_entries WHERE baby_id = g.baby_id AND end_time IS NULL)
      THEN RAISE EXCEPTION 'sleep_already_running'; END IF;
      INSERT INTO public.sleep_entries (baby_id, user_id, start_time, notes)
      VALUES (g.baby_id, g.owner_id, clock_timestamp(), NULLIF(trim(p_payload->>'notes'), '')) RETURNING id INTO entry_id;
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
        clock_timestamp(), clock_timestamp(), NULLIF(trim(p_payload->>'notes'), ''),
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
REVOKE ALL ON FUNCTION caretaker_private.access(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION caretaker_private.access(text, jsonb) TO authenticated;

CREATE FUNCTION public.caretaker_access(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT caretaker_private.access(p_action, p_payload);
$$;
REVOKE ALL ON FUNCTION public.caretaker_access(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.caretaker_access(text, jsonb) TO authenticated;
COMMIT;
