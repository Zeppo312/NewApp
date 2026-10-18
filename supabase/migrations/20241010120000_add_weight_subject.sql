-- Add subject column to allow tracking weights for mom and baby
ALTER TABLE public.weight_entries
ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'mom';

-- Constrain allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'weight_entries_subject_check'
      AND conrelid = 'public.weight_entries'::regclass
  ) THEN
    ALTER TABLE public.weight_entries
    ADD CONSTRAINT weight_entries_subject_check CHECK (subject IN ('mom', 'baby'));
  END IF;
END
$$;

-- Replace unique constraint so the same user can store entries per subject and date
ALTER TABLE public.weight_entries
DROP CONSTRAINT IF EXISTS weight_entries_user_id_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'weight_entries_user_subject_date_key'
      AND conrelid = 'public.weight_entries'::regclass
  ) THEN
    ALTER TABLE public.weight_entries
    ADD CONSTRAINT weight_entries_user_subject_date_key UNIQUE (user_id, subject, date);
  END IF;
END
$$;

-- Helpful index for lookups by user and subject
CREATE INDEX IF NOT EXISTS weight_entries_user_subject_date_idx ON public.weight_entries (user_id, subject, date);
