-- Create shared baby tooth eruption entries.
-- One active entry per tooth position and baby.

CREATE TABLE IF NOT EXISTS public.tooth_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  tooth_position TEXT NOT NULL,
  eruption_date DATE NOT NULL,
  notes TEXT,
  symptoms TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One entry per tooth per baby.
CREATE UNIQUE INDEX IF NOT EXISTS tooth_entries_unique_baby_tooth
  ON public.tooth_entries (baby_id, tooth_position);

CREATE INDEX IF NOT EXISTS tooth_entries_baby_date_idx
  ON public.tooth_entries (baby_id, eruption_date DESC);

CREATE INDEX IF NOT EXISTS tooth_entries_baby_tooth_idx
  ON public.tooth_entries (baby_id, tooth_position);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tooth_entries_tooth_position_check'
      AND conrelid = 'public.tooth_entries'::regclass
  ) THEN
    ALTER TABLE public.tooth_entries
      ADD CONSTRAINT tooth_entries_tooth_position_check CHECK (
        tooth_position IN (
          'upper_right_second_molar',
          'upper_right_first_molar',
          'upper_right_canine',
          'upper_right_lateral_incisor',
          'upper_right_central_incisor',
          'upper_left_central_incisor',
          'upper_left_lateral_incisor',
          'upper_left_canine',
          'upper_left_first_molar',
          'upper_left_second_molar',
          'lower_right_second_molar',
          'lower_right_first_molar',
          'lower_right_canine',
          'lower_right_lateral_incisor',
          'lower_right_central_incisor',
          'lower_left_central_incisor',
          'lower_left_lateral_incisor',
          'lower_left_canine',
          'lower_left_first_molar',
          'lower_left_second_molar'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tooth_entries_eruption_date_not_future'
      AND conrelid = 'public.tooth_entries'::regclass
  ) THEN
    ALTER TABLE public.tooth_entries
      ADD CONSTRAINT tooth_entries_eruption_date_not_future CHECK (eruption_date <= CURRENT_DATE);
  END IF;
END $$;

ALTER TABLE public.tooth_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tooth entries: select by baby member" ON public.tooth_entries;
CREATE POLICY "Tooth entries: select by baby member"
  ON public.tooth_entries
  FOR SELECT
  USING (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Tooth entries: insert by baby member" ON public.tooth_entries;
CREATE POLICY "Tooth entries: insert by baby member"
  ON public.tooth_entries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_baby_member(baby_id)
  );

DROP POLICY IF EXISTS "Tooth entries: update by baby member" ON public.tooth_entries;
CREATE POLICY "Tooth entries: update by baby member"
  ON public.tooth_entries
  FOR UPDATE
  USING (public.is_baby_member(baby_id))
  WITH CHECK (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Tooth entries: delete by baby member" ON public.tooth_entries;
CREATE POLICY "Tooth entries: delete by baby member"
  ON public.tooth_entries
  FOR DELETE
  USING (public.is_baby_member(baby_id));

-- Reuse the shared updated_at trigger function when present.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tooth_entries_updated_at ON public.tooth_entries;
CREATE TRIGGER trg_tooth_entries_updated_at
BEFORE UPDATE ON public.tooth_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
