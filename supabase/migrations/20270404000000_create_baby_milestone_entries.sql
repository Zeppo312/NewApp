-- Create free milestone entries for babies (firsts, memories, custom milestones).

CREATE TABLE IF NOT EXISTS public.baby_milestone_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  event_date DATE NOT NULL,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'baby_milestone_entries_title_not_blank'
      AND conrelid = 'public.baby_milestone_entries'::regclass
  ) THEN
    ALTER TABLE public.baby_milestone_entries
      ADD CONSTRAINT baby_milestone_entries_title_not_blank
      CHECK (char_length(trim(title)) > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'baby_milestone_entries_category_check'
      AND conrelid = 'public.baby_milestone_entries'::regclass
  ) THEN
    ALTER TABLE public.baby_milestone_entries
      ADD CONSTRAINT baby_milestone_entries_category_check
      CHECK (
        category IN (
          'motorik',
          'ernaehrung',
          'sprache',
          'zahn',
          'schlaf',
          'sonstiges'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS baby_milestone_entries_baby_date_idx
  ON public.baby_milestone_entries (baby_id, event_date DESC);

CREATE INDEX IF NOT EXISTS baby_milestone_entries_baby_category_idx
  ON public.baby_milestone_entries (baby_id, category);

ALTER TABLE public.baby_milestone_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Milestones: select by baby member" ON public.baby_milestone_entries;
CREATE POLICY "Milestones: select by baby member"
  ON public.baby_milestone_entries
  FOR SELECT
  USING (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Milestones: insert by baby member" ON public.baby_milestone_entries;
CREATE POLICY "Milestones: insert by baby member"
  ON public.baby_milestone_entries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_baby_member(baby_id)
  );

DROP POLICY IF EXISTS "Milestones: update by baby member" ON public.baby_milestone_entries;
CREATE POLICY "Milestones: update by baby member"
  ON public.baby_milestone_entries
  FOR UPDATE
  USING (public.is_baby_member(baby_id))
  WITH CHECK (public.is_baby_member(baby_id));

DROP POLICY IF EXISTS "Milestones: delete by baby member" ON public.baby_milestone_entries;
CREATE POLICY "Milestones: delete by baby member"
  ON public.baby_milestone_entries
  FOR DELETE
  USING (public.is_baby_member(baby_id));

-- Reuse shared updated_at trigger function.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_baby_milestone_entries_updated_at ON public.baby_milestone_entries;
CREATE TRIGGER trg_baby_milestone_entries_updated_at
BEFORE UPDATE ON public.baby_milestone_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
