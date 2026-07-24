-- Phase 1: Schema groundwork for multiple babies per user

-- 1) Baby membership table (sharing layer)
CREATE TABLE IF NOT EXISTS public.baby_members (
  baby_id UUID NOT NULL REFERENCES public.baby_info(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (baby_id, user_id)
);

CREATE INDEX IF NOT EXISTS baby_members_user_id_idx ON public.baby_members(user_id);

-- 2) Ensure every user with baby-related data has a baby_info row (one default baby)
WITH users_with_baby_data AS (
  SELECT user_id FROM public.baby_daily WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.baby_diary WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.baby_care_entries WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.baby_milestone_progress WHERE user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.baby_current_phase WHERE user_id IS NOT NULL
)
INSERT INTO public.baby_info (user_id, created_at, updated_at)
SELECT u.user_id, now(), now()
FROM users_with_baby_data u
WHERE NOT EXISTS (
  SELECT 1 FROM public.baby_info bi WHERE bi.user_id = u.user_id
);

-- 3) Add baby_id columns (nullable for now) + backfill from baby_info
ALTER TABLE public.baby_diary
  ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE;

UPDATE public.baby_diary bd
SET baby_id = bi.id
FROM public.baby_info bi
WHERE bd.baby_id IS NULL AND bd.user_id = bi.user_id;

CREATE INDEX IF NOT EXISTS baby_diary_baby_id_idx ON public.baby_diary(baby_id);

ALTER TABLE public.baby_daily
  ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE;

UPDATE public.baby_daily bd
SET baby_id = bi.id
FROM public.baby_info bi
WHERE bd.baby_id IS NULL AND bd.user_id = bi.user_id;

CREATE INDEX IF NOT EXISTS baby_daily_baby_id_idx ON public.baby_daily(baby_id);

ALTER TABLE public.baby_care_entries
  ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE;

UPDATE public.baby_care_entries bce
SET baby_id = bi.id
FROM public.baby_info bi
WHERE bce.baby_id IS NULL AND bce.user_id = bi.user_id;

CREATE INDEX IF NOT EXISTS baby_care_entries_baby_id_idx ON public.baby_care_entries(baby_id);

ALTER TABLE public.baby_milestone_progress
  ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE;

UPDATE public.baby_milestone_progress bmp
SET baby_id = bi.id
FROM public.baby_info bi
WHERE bmp.baby_id IS NULL AND bmp.user_id = bi.user_id;

CREATE INDEX IF NOT EXISTS baby_milestone_progress_baby_id_idx ON public.baby_milestone_progress(baby_id);

ALTER TABLE public.baby_current_phase
  ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE;

UPDATE public.baby_current_phase bcp
SET baby_id = bi.id
FROM public.baby_info bi
WHERE bcp.baby_id IS NULL AND bcp.user_id = bi.user_id;

CREATE INDEX IF NOT EXISTS baby_current_phase_baby_id_idx ON public.baby_current_phase(baby_id);

-- sleep_entries exists outside migrations in this repo; guard it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sleep_entries'
  ) THEN
    EXECUTE 'ALTER TABLE public.sleep_entries ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE';
    EXECUTE 'UPDATE public.sleep_entries se SET baby_id = bi.id FROM public.baby_info bi WHERE se.baby_id IS NULL AND se.user_id = bi.user_id';
    EXECUTE 'CREATE INDEX IF NOT EXISTS sleep_entries_baby_id_idx ON public.sleep_entries(baby_id)';
  END IF;
END $$;

-- 4) Backfill baby_members for existing babies
INSERT INTO public.baby_members (baby_id, user_id, role)
SELECT id, user_id, 'owner'
FROM public.baby_info
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5) Drop single-baby uniqueness constraints, add baby_id-based ones
ALTER TABLE public.baby_info
  DROP CONSTRAINT IF EXISTS baby_info_user_id_key;

ALTER TABLE public.baby_current_phase
  DROP CONSTRAINT IF EXISTS baby_current_phase_user_id_key;

ALTER TABLE public.baby_milestone_progress
  DROP CONSTRAINT IF EXISTS baby_milestone_progress_user_id_milestone_id_key;

ALTER TABLE public.baby_current_phase
  ADD CONSTRAINT baby_current_phase_baby_id_key UNIQUE (baby_id);

ALTER TABLE public.baby_milestone_progress
  ADD CONSTRAINT baby_milestone_progress_baby_id_milestone_id_key UNIQUE (baby_id, milestone_id);

-- Done
