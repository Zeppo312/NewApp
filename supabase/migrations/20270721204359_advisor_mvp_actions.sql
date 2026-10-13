-- Lottis Fürsorge MVP: Mama-Check-in und abschließbare Hinweis-Aktionen.
-- Liegt nach der ursprünglichen Advisor-Migration, da dieses Repository
-- bereits vorgeplante Migrationen bis Juli 2027 enthält.

ALTER TABLE public.advisor_messages
  ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_notification_id TEXT,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.advisor_mama_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  energy TEXT NOT NULL CHECK (energy IN ('good', 'okay', 'low')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT advisor_mama_checkins_daily_unique
    UNIQUE (user_id, baby_id, local_date)
);

CREATE INDEX IF NOT EXISTS advisor_mama_checkins_user_date_idx
  ON public.advisor_mama_checkins (user_id, local_date DESC);

ALTER TABLE public.advisor_mama_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advisor_mama_checkins_select_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_select_own
  ON public.advisor_mama_checkins
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS advisor_mama_checkins_insert_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_insert_own
  ON public.advisor_mama_checkins
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS advisor_mama_checkins_update_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_update_own
  ON public.advisor_mama_checkins
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS advisor_mama_checkins_delete_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_delete_own
  ON public.advisor_mama_checkins
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Seit April 2026 können neue Tabellen je nach Data-API-Einstellung ohne
-- automatische Grants entstehen. RLS bleibt die eigentliche Zeilensperre.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.advisor_mama_checkins TO authenticated;

COMMENT ON TABLE public.advisor_mama_checkins IS
  'Ein extrem kurzer täglicher Energie-Check-in für Lottis Fürsorge.';
COMMENT ON COLUMN public.advisor_messages.remind_at IS
  'Vom Nutzer gewählter Zeitpunkt für eine lokale Erinnerung an den Hinweis.';
COMMENT ON COLUMN public.advisor_messages.reminder_notification_id IS
  'Lokale Expo-Notification-ID, um eine Erinnerung ersetzen oder löschen zu können.';
COMMENT ON COLUMN public.advisor_messages.shared_at IS
  'Zeitpunkt, zu dem der Hinweis über das native Teilen-Menü weitergegeben wurde.';
