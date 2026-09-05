-- ============================================================================
-- Group chat events: event cards with RSVP and optional cover image
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Event tables
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_group_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT community_group_events_title_check CHECK (length(btrim(title)) > 0),
  CONSTRAINT community_group_events_location_check CHECK (length(btrim(location)) > 0),
  CONSTRAINT community_group_events_ends_at_check CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT community_group_events_cancelled_meta_check CHECK (
    (status = 'active' AND cancelled_at IS NULL)
    OR
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.community_group_event_rsvps (
  event_id UUID NOT NULL REFERENCES public.community_group_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_group_events_group_id_idx
  ON public.community_group_events(group_id);

CREATE INDEX IF NOT EXISTS community_group_events_group_status_idx
  ON public.community_group_events(group_id, status);

CREATE INDEX IF NOT EXISTS community_group_events_created_by_idx
  ON public.community_group_events(created_by_user_id);

CREATE INDEX IF NOT EXISTS community_group_events_starts_at_idx
  ON public.community_group_events(starts_at);

CREATE INDEX IF NOT EXISTS community_group_event_rsvps_event_id_idx
  ON public.community_group_event_rsvps(event_id);

CREATE INDEX IF NOT EXISTS community_group_event_rsvps_user_id_idx
  ON public.community_group_event_rsvps(user_id);

-- --------------------------------------------------------------------------
-- 2. Extend community_group_messages for event cards
-- --------------------------------------------------------------------------

ALTER TABLE public.community_group_messages
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.community_group_events(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_group_messages_event_id_unique_idx
  ON public.community_group_messages(event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE public.community_group_messages
  DROP CONSTRAINT IF EXISTS community_group_messages_message_type_check;

ALTER TABLE public.community_group_messages
  ADD CONSTRAINT community_group_messages_message_type_check
  CHECK (message_type IN ('text', 'voice', 'event'));

ALTER TABLE public.community_group_messages
  DROP CONSTRAINT IF EXISTS community_group_messages_content_or_audio_check;

ALTER TABLE public.community_group_messages
  ADD CONSTRAINT community_group_messages_content_or_audio_check
  CHECK (
    (
      message_type = 'text'
      AND content IS NOT NULL
      AND length(btrim(content)) > 0
      AND audio_storage_path IS NULL
      AND audio_duration_ms IS NULL
      AND event_id IS NULL
    )
    OR
    (
      message_type = 'voice'
      AND content IS NULL
      AND audio_storage_path IS NOT NULL
      AND length(btrim(audio_storage_path)) > 0
      AND audio_duration_ms IS NOT NULL
      AND audio_duration_ms > 0
      AND event_id IS NULL
    )
    OR
    (
      message_type = 'event'
      AND content IS NULL
      AND audio_storage_path IS NULL
      AND audio_duration_ms IS NULL
      AND event_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "group_messages_insert" ON public.community_group_messages;
CREATE POLICY "group_messages_insert"
  ON public.community_group_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_active_group_member(group_id)
    AND message_type IN ('text', 'voice')
  );

CREATE OR REPLACE FUNCTION public.prevent_group_event_message_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.event_id IS NOT NULL
    AND current_setting('app.allow_group_event_message_delete', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Event-Nachrichten können nicht direkt gelöscht werden'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_group_event_message_delete_trigger
  ON public.community_group_messages;

CREATE TRIGGER prevent_group_event_message_delete_trigger
  BEFORE DELETE ON public.community_group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_group_event_message_delete();

-- --------------------------------------------------------------------------
-- 3. Helper functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_group_event(
  target_event_id UUID,
  target_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_group_events event
    WHERE event.id = target_event_id
      AND public.is_active_group_member(event.group_id, COALESCE(target_user_id, auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_group_event(
  target_event_id UUID,
  target_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_group_events event
    WHERE event.id = target_event_id
      AND (
        event.created_by_user_id = COALESCE(target_user_id, auth.uid())
        OR public.can_manage_group(event.group_id, COALESCE(target_user_id, auth.uid()))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_cancel_or_delete_group_event(
  target_event_id UUID,
  target_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_group_events event
    WHERE event.id = target_event_id
      AND (
        event.created_by_user_id = COALESCE(target_user_id, auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.community_group_members member
          WHERE member.group_id = event.group_id
            AND member.user_id = COALESCE(target_user_id, auth.uid())
            AND member.status = 'active'
            AND member.role = 'owner'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.create_group_chat_event(
  target_group_id UUID,
  target_title TEXT,
  target_location TEXT,
  target_starts_at TIMESTAMPTZ,
  target_description TEXT DEFAULT NULL,
  target_cover_image_url TEXT DEFAULT NULL,
  target_reply_to_id UUID DEFAULT NULL,
  target_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  event_id UUID,
  message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_title TEXT := NULLIF(BTRIM(target_title), '');
  normalized_location TEXT := NULLIF(BTRIM(target_location), '');
  normalized_description TEXT := NULLIF(BTRIM(target_description), '');
  normalized_cover_image_url TEXT := NULLIF(BTRIM(target_cover_image_url), '');
  inserted_event_id UUID;
  inserted_message_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF normalized_title IS NULL THEN
    RAISE EXCEPTION 'Bitte gib einen Titel ein.'
      USING ERRCODE = 'P0001';
  END IF;

  IF normalized_location IS NULL THEN
    RAISE EXCEPTION 'Bitte gib einen Ort ein.'
      USING ERRCODE = 'P0001';
  END IF;

  IF target_starts_at IS NULL THEN
    RAISE EXCEPTION 'Bitte gib Datum und Uhrzeit an.'
      USING ERRCODE = 'P0001';
  END IF;

  IF target_ends_at IS NOT NULL AND target_ends_at < target_starts_at THEN
    RAISE EXCEPTION 'Die Endzeit muss nach der Startzeit liegen.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_group_member(target_group_id) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.community_group_events (
    group_id,
    created_by_user_id,
    title,
    description,
    location,
    starts_at,
    ends_at,
    cover_image_url,
    status,
    created_at,
    updated_at
  )
  VALUES (
    target_group_id,
    auth.uid(),
    normalized_title,
    normalized_description,
    normalized_location,
    target_starts_at,
    target_ends_at,
    normalized_cover_image_url,
    'active',
    now(),
    now()
  )
  RETURNING id INTO inserted_event_id;

  INSERT INTO public.community_group_messages (
    group_id,
    sender_id,
    content,
    message_type,
    event_id,
    reply_to_id,
    created_at
  )
  VALUES (
    target_group_id,
    auth.uid(),
    NULL,
    'event',
    inserted_event_id,
    target_reply_to_id,
    now()
  )
  RETURNING id INTO inserted_message_id;

  RETURN QUERY
  SELECT inserted_event_id, inserted_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_group_chat_event(
  target_event_id UUID,
  target_title TEXT,
  target_location TEXT,
  target_starts_at TIMESTAMPTZ,
  target_description TEXT DEFAULT NULL,
  target_cover_image_url TEXT DEFAULT NULL,
  target_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_title TEXT := NULLIF(BTRIM(target_title), '');
  normalized_location TEXT := NULLIF(BTRIM(target_location), '');
  normalized_description TEXT := NULLIF(BTRIM(target_description), '');
  normalized_cover_image_url TEXT := NULLIF(BTRIM(target_cover_image_url), '');
  current_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF normalized_title IS NULL THEN
    RAISE EXCEPTION 'Bitte gib einen Titel ein.'
      USING ERRCODE = 'P0001';
  END IF;

  IF normalized_location IS NULL THEN
    RAISE EXCEPTION 'Bitte gib einen Ort ein.'
      USING ERRCODE = 'P0001';
  END IF;

  IF target_starts_at IS NULL THEN
    RAISE EXCEPTION 'Bitte gib Datum und Uhrzeit an.'
      USING ERRCODE = 'P0001';
  END IF;

  IF target_ends_at IS NOT NULL AND target_ends_at < target_starts_at THEN
    RAISE EXCEPTION 'Die Endzeit muss nach der Startzeit liegen.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.can_manage_group_event(target_event_id) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  SELECT event.status INTO current_status
  FROM public.community_group_events event
  WHERE event.id = target_event_id;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Event not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF current_status = 'cancelled' THEN
    RAISE EXCEPTION 'Abgesagte Events können nicht bearbeitet werden.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.community_group_events
  SET
    title = normalized_title,
    description = normalized_description,
    location = normalized_location,
    starts_at = target_starts_at,
    ends_at = target_ends_at,
    cover_image_url = normalized_cover_image_url,
    updated_at = now()
  WHERE id = target_event_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_group_chat_event(
  target_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_cancel_or_delete_group_event(target_event_id) THEN
    RAISE EXCEPTION 'Nur Event-Ersteller:innen oder Gruppen-Besitzer:innen koennen Events absagen.'
      USING ERRCODE = '42501';
  END IF;

  SELECT event.status INTO current_status
  FROM public.community_group_events event
  WHERE event.id = target_event_id;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Event not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF current_status = 'cancelled' THEN
    RETURN TRUE;
  END IF;

  UPDATE public.community_group_events
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by_user_id = auth.uid(),
    updated_at = now()
  WHERE id = target_event_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_group_chat_event(
  target_event_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_message_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_cancel_or_delete_group_event(target_event_id) THEN
    RAISE EXCEPTION 'Nur Event-Ersteller:innen oder Gruppen-Besitzer:innen koennen Events loeschen.'
      USING ERRCODE = '42501';
  END IF;

  SELECT msg.id
  INTO linked_message_id
  FROM public.community_group_messages msg
  WHERE msg.event_id = target_event_id
  LIMIT 1;

  IF linked_message_id IS NULL THEN
    RAISE EXCEPTION 'Event not found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.allow_group_event_message_delete', 'on', true);

  DELETE FROM public.community_group_messages
  WHERE id = linked_message_id;

  DELETE FROM public.community_group_events
  WHERE id = target_event_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_group_chat_event(
  target_event_id UUID,
  target_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_group_id UUID;
  event_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF target_status NOT IN ('yes', 'no', 'maybe') THEN
    RAISE EXCEPTION 'Ungültiger RSVP-Status.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT event.group_id, event.status
  INTO event_group_id, event_status
  FROM public.community_group_events event
  WHERE event.id = target_event_id;

  IF event_group_id IS NULL THEN
    RAISE EXCEPTION 'Event not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_active_group_member(event_group_id) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = '42501';
  END IF;

  IF event_status = 'cancelled' THEN
    RAISE EXCEPTION 'Für abgesagte Events sind keine Antworten mehr möglich.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.community_group_event_rsvps (
    event_id,
    user_id,
    status,
    responded_at,
    updated_at
  )
  VALUES (
    target_event_id,
    auth.uid(),
    target_status,
    now(),
    now()
  )
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_group_event(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_group_event(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_cancel_or_delete_group_event(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group_chat_event(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_group_chat_event(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_group_chat_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_group_chat_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_group_chat_event(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_view_group_event(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_group_event(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_cancel_or_delete_group_event(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_chat_event(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_chat_event(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_group_chat_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_group_chat_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_group_chat_event(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- 4. RLS
-- --------------------------------------------------------------------------

ALTER TABLE public.community_group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_events_select" ON public.community_group_events;
CREATE POLICY "group_events_select"
  ON public.community_group_events
  FOR SELECT
  USING (public.is_active_group_member(group_id));

DROP POLICY IF EXISTS "group_event_rsvps_select" ON public.community_group_event_rsvps;
CREATE POLICY "group_event_rsvps_select"
  ON public.community_group_event_rsvps
  FOR SELECT
  USING (public.can_view_group_event(event_id));

-- --------------------------------------------------------------------------
-- 5. Storage bucket for event covers
-- --------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('group-event-images', 'group-event-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read group-event-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload own group-event-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own group-event-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own group-event-images" ON storage.objects;

CREATE POLICY "Public read group-event-images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'group-event-images');

CREATE POLICY "Authenticated upload own group-event-images" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-event-images'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "Authenticated update own group-event-images" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'group-event-images'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'group-event-images'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "Authenticated delete own group-event-images" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-event-images'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
  );

-- --------------------------------------------------------------------------
-- 6. Notification webhook + summaries with event preview
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_group_message_notification_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_base_url text;
  webhook_url text;
  webhook_secret text;
  request_id bigint;
BEGIN
  supabase_base_url := nullif(current_setting('app.settings.supabase_url', true), '');
  webhook_secret := nullif(current_setting('app.settings.direct_message_webhook_secret', true), '');

  IF supabase_base_url IS NULL THEN
    supabase_base_url := 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
  END IF;

  IF webhook_secret IS NULL THEN
    RAISE WARNING 'Group message webhook secret missing; skipping push webhook';
    RETURN NEW;
  END IF;

  webhook_url := supabase_base_url || '/functions/v1/send-group-message-notification';

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'community_group_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'group_id', NEW.group_id,
        'sender_id', NEW.sender_id,
        'content', NEW.content,
        'message_type', NEW.message_type,
        'event_id', NEW.event_id,
        'created_at', NEW.created_at
      )
    )
  ) INTO request_id;

  RAISE NOTICE 'Group message webhook sent with request_id: %', request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send group message webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_group_chat_summaries()
RETURNS TABLE(
  group_id UUID,
  group_name TEXT,
  group_visibility TEXT,
  latest_message_content TEXT,
  latest_message_type TEXT,
  latest_message_preview TEXT,
  latest_message_sender_id UUID,
  latest_message_created_at TIMESTAMPTZ,
  unread_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id AS group_id,
    g.name AS group_name,
    g.visibility::text AS group_visibility,
    latest_msg.content AS latest_message_content,
    latest_msg.message_type AS latest_message_type,
    CASE
      WHEN latest_msg.message_type = 'voice' THEN 'Sprachnachricht'
      WHEN latest_msg.message_type = 'event' THEN
        COALESCE('Event: ' || NULLIF(event_msg.title, ''), 'Event')
      ELSE latest_msg.content
    END AS latest_message_preview,
    latest_msg.sender_id AS latest_message_sender_id,
    latest_msg.created_at AS latest_message_created_at,
    COALESCE((
      SELECT count(*)::integer
      FROM community_group_messages msg
      WHERE msg.group_id = g.id
        AND msg.sender_id <> auth.uid()
        AND msg.created_at > COALESCE(
          (
            SELECT r.last_read_at
            FROM community_group_chat_reads r
            WHERE r.group_id = g.id
              AND r.user_id = auth.uid()
          ),
          '1970-01-01'::timestamptz
        )
    ), 0) AS unread_count
  FROM community_groups g
  INNER JOIN community_group_members m
    ON m.group_id = g.id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  LEFT JOIN LATERAL (
    SELECT msg.id, msg.content, msg.message_type, msg.sender_id, msg.created_at, msg.event_id
    FROM community_group_messages msg
    WHERE msg.group_id = g.id
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) latest_msg ON true
  LEFT JOIN public.community_group_events event_msg
    ON event_msg.id = latest_msg.event_id
  WHERE latest_msg.id IS NOT NULL
  ORDER BY latest_msg.created_at DESC;
$$;

-- --------------------------------------------------------------------------
-- 7. Realtime
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'community_group_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_group_events;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'community_group_event_rsvps'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_group_event_rsvps;
    END IF;
  ELSE
    RAISE NOTICE 'supabase_realtime publication not found, skipping';
  END IF;
END $$;
