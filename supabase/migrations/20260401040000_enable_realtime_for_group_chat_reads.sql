-- Enable Supabase Realtime for community_group_chat_reads so the client
-- can immediately update unread badges when a group chat is marked as read.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'community_group_chat_reads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_group_chat_reads;
    END IF;
  ELSE
    RAISE NOTICE 'supabase_realtime publication not found, skipping';
  END IF;
END $$;
