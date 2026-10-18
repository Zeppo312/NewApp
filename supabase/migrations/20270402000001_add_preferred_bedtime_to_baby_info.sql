ALTER TABLE public.baby_info
ADD COLUMN IF NOT EXISTS preferred_bedtime TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'baby_info_preferred_bedtime_format'
  ) THEN
    ALTER TABLE public.baby_info
    ADD CONSTRAINT baby_info_preferred_bedtime_format
    CHECK (
      preferred_bedtime IS NULL
      OR preferred_bedtime ~ '^([01][0-9]|2[0-3]):([0-5][0-9])$'
    );
  END IF;
END;
$$;

COMMENT ON COLUMN public.baby_info.preferred_bedtime IS 'Optional preferred bedtime in HH:mm (24h), used as sleep prediction anchor';
