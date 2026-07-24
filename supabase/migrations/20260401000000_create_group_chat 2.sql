-- ============================================================================
-- Group Chat: messages + read tracking
-- Reuses existing RLS helpers: is_active_group_member(), can_manage_group()
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Messages table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.community_group_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 2. Read tracking (one row per user per group)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_group_chat_reads (
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- --------------------------------------------------------------------------
-- 3. Indexes
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS community_group_messages_group_id_idx
  ON public.community_group_messages(group_id);

CREATE INDEX IF NOT EXISTS community_group_messages_sender_id_idx
  ON public.community_group_messages(sender_id);

CREATE INDEX IF NOT EXISTS community_group_messages_created_at_idx
  ON public.community_group_messages(created_at);

CREATE INDEX IF NOT EXISTS community_group_messages_reply_to_id_idx
  ON public.community_group_messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 4. Reply-to validation trigger
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_group_message_reply_to()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.community_group_messages msg
      WHERE msg.id = NEW.reply_to_id
        AND msg.group_id = NEW.group_id
    ) THEN
      RAISE EXCEPTION 'reply_to_id must reference a message in the same group';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_group_message_reply_to_trigger
  ON public.community_group_messages;

CREATE TRIGGER validate_group_message_reply_to_trigger
  BEFORE INSERT OR UPDATE ON public.community_group_messages
  FOR EACH ROW
  WHEN (NEW.reply_to_id IS NOT NULL)
  EXECUTE FUNCTION public.validate_group_message_reply_to();

-- --------------------------------------------------------------------------
-- 5. RLS policies for messages
-- --------------------------------------------------------------------------

ALTER TABLE public.community_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_messages_select" ON public.community_group_messages;
CREATE POLICY "group_messages_select"
  ON public.community_group_messages
  FOR SELECT
  USING (public.is_active_group_member(group_id));

DROP POLICY IF EXISTS "group_messages_insert" ON public.community_group_messages;
CREATE POLICY "group_messages_insert"
  ON public.community_group_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_active_group_member(group_id)
  );

DROP POLICY IF EXISTS "group_messages_delete_own" ON public.community_group_messages;
CREATE POLICY "group_messages_delete_own"
  ON public.community_group_messages
  FOR DELETE
  USING (
    auth.uid() = sender_id
    AND public.is_active_group_member(group_id)
  );

DROP POLICY IF EXISTS "group_messages_delete_admin" ON public.community_group_messages;
CREATE POLICY "group_messages_delete_admin"
  ON public.community_group_messages
  FOR DELETE
  USING (public.can_manage_group(group_id));

-- --------------------------------------------------------------------------
-- 6. RLS policies for read tracking
-- --------------------------------------------------------------------------

ALTER TABLE public.community_group_chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_chat_reads_select" ON public.community_group_chat_reads;
CREATE POLICY "group_chat_reads_select"
  ON public.community_group_chat_reads
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  );

DROP POLICY IF EXISTS "group_chat_reads_insert" ON public.community_group_chat_reads;
CREATE POLICY "group_chat_reads_insert"
  ON public.community_group_chat_reads
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  );

DROP POLICY IF EXISTS "group_chat_reads_update" ON public.community_group_chat_reads;
CREATE POLICY "group_chat_reads_update"
  ON public.community_group_chat_reads
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_group_member(group_id)
  );

-- --------------------------------------------------------------------------
-- 7. RPC: unread count
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_group_chat_unread_count(target_group_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_active_group_member(target_group_id) THEN 0
    ELSE COALESCE((
      SELECT count(*)::integer
      FROM public.community_group_messages msg
      WHERE msg.group_id = target_group_id
        AND msg.sender_id <> auth.uid()
        AND msg.created_at > COALESCE(
          (
            SELECT r.last_read_at
            FROM public.community_group_chat_reads r
            WHERE r.group_id = target_group_id
              AND r.user_id = auth.uid()
          ),
          '1970-01-01'::timestamptz
        )
    ), 0)
  END;
$$;

-- --------------------------------------------------------------------------
-- 8. Enable realtime
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'community_group_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_group_messages;
    END IF;
  ELSE
    RAISE NOTICE 'supabase_realtime publication not found, skipping';
  END IF;
END $$;
