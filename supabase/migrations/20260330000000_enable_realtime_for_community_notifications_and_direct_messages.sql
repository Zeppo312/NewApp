-- Ensure community badge sources are included in Supabase Realtime publication.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'community_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE public.community_notifications;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'direct_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE public.direct_messages;
    END IF;
  ELSE
    RAISE NOTICE 'supabase_realtime publication not found. Enable Realtime manually for public.community_notifications and public.direct_messages.';
  END IF;
END $$;
