-- Ensure Vitamin-D habit checks are included in Supabase Realtime publication.

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
        AND tablename = 'baby_daily_habit_checks'
    ) THEN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE public.baby_daily_habit_checks;
    END IF;
  ELSE
    RAISE NOTICE 'supabase_realtime publication not found. Enable Realtime manually for public.baby_daily_habit_checks.';
  END IF;
END $$;
