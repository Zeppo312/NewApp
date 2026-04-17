-- ============================================================================
-- Voice messages for DIRECT CHATS
-- Safe to run on any production system that has direct_messages.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Columns + constraints on direct_messages
-- --------------------------------------------------------------------------

ALTER TABLE public.direct_messages
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS audio_mime_type TEXT DEFAULT 'audio/mp4';

ALTER TABLE public.direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_message_type_check;

ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_message_type_check
  CHECK (message_type IN ('text', 'voice'));

-- Safety: fix any existing rows with empty/whitespace-only content
-- so the CHECK constraint below can be added without violating rows.
UPDATE public.direct_messages
SET content = '(leere Nachricht)'
WHERE message_type = 'text'
  AND (content IS NULL OR length(btrim(content)) = 0);

ALTER TABLE public.direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_content_or_audio_check;

ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_content_or_audio_check
  CHECK (
    (
      message_type = 'text'
      AND content IS NOT NULL
      AND length(btrim(content)) > 0
      AND audio_storage_path IS NULL
      AND audio_duration_ms IS NULL
    )
    OR
    (
      message_type = 'voice'
      AND content IS NULL
      AND audio_storage_path IS NOT NULL
      AND length(btrim(audio_storage_path)) > 0
      AND audio_duration_ms IS NOT NULL
      AND audio_duration_ms > 0
    )
  );

CREATE INDEX IF NOT EXISTS direct_messages_message_type_idx
  ON public.direct_messages (message_type);

-- --------------------------------------------------------------------------
-- 2. Private storage bucket for chat audio
-- --------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Authenticated upload chat-audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own chat-audio" ON storage.objects;

CREATE POLICY "Authenticated upload chat-audio" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-audio'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "Authenticated update own chat-audio" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-audio'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'chat-audio'
    AND auth.uid() IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
  );

-- --------------------------------------------------------------------------
-- 3. Webhook function with message_type support
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_direct_message_notification_webhook()
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
    RAISE WARNING 'Direct message webhook secret missing; skipping push webhook';
    RETURN NEW;
  END IF;

  webhook_url := supabase_base_url || '/functions/v1/send-direct-message-notification';

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'direct_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'sender_id', NEW.sender_id,
        'receiver_id', NEW.receiver_id,
        'content', NEW.content,
        'message_type', NEW.message_type,
        'created_at', NEW.created_at,
        'is_read', NEW.is_read
      )
    )
  ) INTO request_id;

  RAISE NOTICE 'Direct message webhook sent with request_id: %', request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send direct message webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;
