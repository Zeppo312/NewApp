-- ============================================================================
-- Voice messages for GROUP CHATS
-- Only runs if community_group_messages exists. Safe to skip on systems
-- where the Community feature has not yet been deployed.
-- ============================================================================

-- Guard: abort early if the table does not exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'community_group_messages'
  ) THEN
    RAISE NOTICE 'community_group_messages does not exist – skipping group-chat voice migration';
    -- We cannot RETURN from a DO-block to skip the rest of the file,
    -- so we raise an exception that we catch at the outer level.
    -- Instead, every statement below is wrapped in its own guarded DO block.
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 1. Columns + constraints on community_group_messages
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_group_messages'
  ) THEN
    RAISE NOTICE 'Skipping: community_group_messages does not exist';
    RETURN;
  END IF;

  -- Allow NULL content for voice messages
  ALTER TABLE public.community_group_messages
    ALTER COLUMN content DROP NOT NULL;

  -- Add voice columns
  ALTER TABLE public.community_group_messages
    ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS audio_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER,
    ADD COLUMN IF NOT EXISTS audio_mime_type TEXT DEFAULT 'audio/mp4';

  -- Type check
  ALTER TABLE public.community_group_messages
    DROP CONSTRAINT IF EXISTS community_group_messages_message_type_check;
  ALTER TABLE public.community_group_messages
    ADD CONSTRAINT community_group_messages_message_type_check
    CHECK (message_type IN ('text', 'voice'));

  -- Safety: fix any existing rows with empty/whitespace-only content
  UPDATE public.community_group_messages
  SET content = '(leere Nachricht)'
  WHERE message_type = 'text'
    AND (content IS NULL OR length(btrim(content)) = 0);

  -- Content-or-audio exclusivity
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

  CREATE INDEX IF NOT EXISTS community_group_messages_message_type_idx
    ON public.community_group_messages (message_type);
END $$;

-- --------------------------------------------------------------------------
-- 2. Group chat summaries RPC (with voice support)
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_group_messages'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'DROP FUNCTION IF EXISTS public.get_my_group_chat_summaries()';

  -- The function body must be executed as dynamic SQL inside a DO block
  -- because CREATE OR REPLACE FUNCTION cannot sit inside BEGIN/END directly.
  EXECUTE $fn$
    CREATE FUNCTION public.get_my_group_chat_summaries()
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
    AS $rpc$
      SELECT
        g.id AS group_id,
        g.name AS group_name,
        g.visibility::text AS group_visibility,
        latest_msg.content AS latest_message_content,
        latest_msg.message_type AS latest_message_type,
        CASE
          WHEN latest_msg.message_type = 'voice' THEN 'Sprachnachricht'
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
        SELECT msg.id, msg.content, msg.message_type, msg.sender_id, msg.created_at
        FROM community_group_messages msg
        WHERE msg.group_id = g.id
        ORDER BY msg.created_at DESC
        LIMIT 1
      ) latest_msg ON true
      WHERE latest_msg.id IS NOT NULL
      ORDER BY latest_msg.created_at DESC;
    $rpc$;
  $fn$;
END $$;

-- --------------------------------------------------------------------------
-- 3. Group notification webhook with message_type support
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_group_messages'
  ) THEN
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.send_group_message_notification_webhook()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $trg$
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
    $trg$;
  $fn$;
END $$;
