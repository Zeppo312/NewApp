-- Shared daily habit checks per baby (used for Vitamin D and future simple daily habits)

CREATE TABLE IF NOT EXISTS public.baby_daily_habit_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  habit_key TEXT NOT NULL CHECK (habit_key IN ('vitamin_d')),
  day DATE NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_baby_daily_habit_checks_unique_day
  ON public.baby_daily_habit_checks(baby_id, habit_key, day);

CREATE INDEX IF NOT EXISTS idx_baby_daily_habit_checks_lookup
  ON public.baby_daily_habit_checks(baby_id, day DESC);

ALTER TABLE public.baby_daily_habit_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Baby daily habit: select by member" ON public.baby_daily_habit_checks;
CREATE POLICY "Baby daily habit: select by member" ON public.baby_daily_habit_checks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_daily_habit_checks.baby_id AND bi.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.baby_members bm
      WHERE bm.baby_id = baby_daily_habit_checks.baby_id AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Baby daily habit: insert by member" ON public.baby_daily_habit_checks;
CREATE POLICY "Baby daily habit: insert by member" ON public.baby_daily_habit_checks
  FOR INSERT
  WITH CHECK (
    checked_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Baby daily habit: update by member" ON public.baby_daily_habit_checks;
CREATE POLICY "Baby daily habit: update by member" ON public.baby_daily_habit_checks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_daily_habit_checks.baby_id AND bi.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.baby_members bm
      WHERE bm.baby_id = baby_daily_habit_checks.baby_id AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    (
      checked_by = auth.uid()
      OR checked_by IS NULL
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Baby daily habit: delete by member" ON public.baby_daily_habit_checks;
CREATE POLICY "Baby daily habit: delete by member" ON public.baby_daily_habit_checks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_daily_habit_checks.baby_id AND bi.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.baby_members bm
      WHERE bm.baby_id = baby_daily_habit_checks.baby_id AND bm.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_baby_daily_habit_checks_updated_at ON public.baby_daily_habit_checks;
CREATE TRIGGER trg_baby_daily_habit_checks_updated_at
BEFORE UPDATE ON public.baby_daily_habit_checks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
