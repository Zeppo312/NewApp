-- Create table for baby size (height/length) tracking.
CREATE TABLE IF NOT EXISTS public.size_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  size DECIMAL(5, 2) NOT NULL,
  subject TEXT NOT NULL DEFAULT 'baby',
  baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT size_entries_positive CHECK (size > 0),
  CONSTRAINT size_entries_subject_check CHECK (subject = 'baby'),
  CONSTRAINT size_entries_baby_required CHECK (baby_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS size_entries_user_id_date_idx
  ON public.size_entries (user_id, date);

CREATE INDEX IF NOT EXISTS size_entries_user_subject_date_idx
  ON public.size_entries (user_id, subject, date);

CREATE INDEX IF NOT EXISTS size_entries_baby_id_idx
  ON public.size_entries (baby_id);

CREATE INDEX IF NOT EXISTS size_entries_baby_id_date_idx
  ON public.size_entries (baby_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS size_entries_unique_baby_date
  ON public.size_entries (user_id, baby_id, date)
  WHERE subject = 'baby' AND baby_id IS NOT NULL;

ALTER TABLE public.size_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Size entries: select own or baby member" ON public.size_entries;
DROP POLICY IF EXISTS "Size entries: insert own or baby member" ON public.size_entries;
DROP POLICY IF EXISTS "Size entries: update own or baby member" ON public.size_entries;
DROP POLICY IF EXISTS "Size entries: delete own or baby member" ON public.size_entries;

CREATE POLICY "Size entries: select own or baby member"
  ON public.size_entries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  );

CREATE POLICY "Size entries: insert own or baby member"
  ON public.size_entries
  FOR INSERT
  WITH CHECK (
    subject = 'baby'
    AND baby_id IS NOT NULL
    AND (
      auth.uid() = user_id
      OR public.is_baby_member(baby_id)
    )
  );

CREATE POLICY "Size entries: update own or baby member"
  ON public.size_entries
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  )
  WITH CHECK (
    subject = 'baby'
    AND baby_id IS NOT NULL
    AND (
      auth.uid() = user_id
      OR public.is_baby_member(baby_id)
    )
  );

CREATE POLICY "Size entries: delete own or baby member"
  ON public.size_entries
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR (baby_id IS NOT NULL AND public.is_baby_member(baby_id))
  );
