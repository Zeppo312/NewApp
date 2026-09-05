-- Add baby_id to weight entries for multi-baby support.

ALTER TABLE public.weight_entries
  ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS weight_entries_baby_id_idx ON public.weight_entries (baby_id);
CREATE INDEX IF NOT EXISTS weight_entries_baby_id_date_idx ON public.weight_entries (baby_id, date);

-- Backfill baby_id for existing baby entries using the oldest baby membership per user.
WITH first_baby AS (
  SELECT DISTINCT ON (bm.user_id) bm.user_id, bm.baby_id
  FROM public.baby_members bm
  JOIN public.baby_info bi ON bi.id = bm.baby_id
  ORDER BY bm.user_id, bi.created_at ASC
)
UPDATE public.weight_entries we
SET baby_id = fb.baby_id
FROM first_baby fb
WHERE we.subject = 'baby'
  AND we.baby_id IS NULL
  AND we.user_id = fb.user_id;

-- Drop old unique constraints to allow multiple babies.
ALTER TABLE public.weight_entries
  DROP CONSTRAINT IF EXISTS weight_entries_user_subject_date_key;

ALTER TABLE public.weight_entries
  DROP CONSTRAINT IF EXISTS weight_entries_user_id_date_key;

-- Unique per user/date for mom, per user/baby/date for baby.
CREATE UNIQUE INDEX IF NOT EXISTS weight_entries_unique_mom_date
  ON public.weight_entries (user_id, date)
  WHERE subject = 'mom';

CREATE UNIQUE INDEX IF NOT EXISTS weight_entries_unique_baby_date
  ON public.weight_entries (user_id, baby_id, date)
  WHERE subject = 'baby';

-- Update RLS policies to use baby membership.
DROP POLICY IF EXISTS "Users can insert their own weight entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Users can view their own weight entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Users can update their own weight entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Users can delete their own weight entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Users can view own and partner baby weight entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Users can delete own and partner baby weight entries" ON public.weight_entries;

CREATE POLICY "Weight entries: select own or baby member"
  ON public.weight_entries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (subject = 'baby' AND baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  );

CREATE POLICY "Weight entries: insert own or baby member"
  ON public.weight_entries
  FOR INSERT
  WITH CHECK (
    (subject = 'mom' AND auth.uid() = user_id)
    OR (subject = 'baby' AND baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  );

CREATE POLICY "Weight entries: update own or baby member"
  ON public.weight_entries
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (subject = 'baby' AND baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (subject = 'baby' AND baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  );

CREATE POLICY "Weight entries: delete own or baby member"
  ON public.weight_entries
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR (subject = 'baby' AND baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  );
