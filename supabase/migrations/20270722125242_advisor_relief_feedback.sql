-- Feedback-Ereignisse für den zustandsabhängigen Entlastungsfluss.
-- Bewusst als Event-Tabelle modelliert: So bleiben verworfene und hilfreiche
-- Vorschläge als Lernsignal erhalten, statt sich gegenseitig zu überschreiben.

CREATE TABLE IF NOT EXISTS public.advisor_relief_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  energy TEXT NOT NULL CHECK (energy IN ('good', 'okay', 'low')),
  relief_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('accepted', 'delegated', 'dismissed', 'helped', 'not_helpful')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advisor_relief_events_user_day_idx
  ON public.advisor_relief_events (user_id, baby_id, local_date, created_at);

ALTER TABLE public.advisor_relief_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advisor_relief_events_select_own
  ON public.advisor_relief_events;
CREATE POLICY advisor_relief_events_select_own
  ON public.advisor_relief_events
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_relief_events.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS advisor_relief_events_insert_own
  ON public.advisor_relief_events;
CREATE POLICY advisor_relief_events_insert_own
  ON public.advisor_relief_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_relief_events.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS advisor_relief_events_delete_own
  ON public.advisor_relief_events;
CREATE POLICY advisor_relief_events_delete_own
  ON public.advisor_relief_events
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_relief_events.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, DELETE
  ON public.advisor_relief_events TO authenticated;

COMMENT ON TABLE public.advisor_relief_events IS
  'Nutzerfeedback zu konkreten Entlastungsvorschlägen in Lottis Fürsorge.';

-- Der Check-in gehört nicht nur zum Nutzer, sondern muss sich auch auf ein
-- Baby beziehen, bei dem der Nutzer Mitglied ist.
DROP POLICY IF EXISTS advisor_mama_checkins_select_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_select_own
  ON public.advisor_mama_checkins
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_mama_checkins.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS advisor_mama_checkins_insert_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_insert_own
  ON public.advisor_mama_checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_mama_checkins.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS advisor_mama_checkins_update_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_update_own
  ON public.advisor_mama_checkins
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_mama_checkins.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_mama_checkins.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS advisor_mama_checkins_delete_own
  ON public.advisor_mama_checkins;
CREATE POLICY advisor_mama_checkins_delete_own
  ON public.advisor_mama_checkins
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = advisor_mama_checkins.baby_id
        AND bm.user_id = (SELECT auth.uid())
    )
  );
