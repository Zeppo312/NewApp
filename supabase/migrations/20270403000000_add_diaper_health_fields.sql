-- Add diaper health detail fields for fever/suppository tracking

ALTER TABLE public.baby_care_entries
  ADD COLUMN IF NOT EXISTS diaper_fever_measured BOOLEAN,
  ADD COLUMN IF NOT EXISTS diaper_temperature_c NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS diaper_suppository_given BOOLEAN,
  ADD COLUMN IF NOT EXISTS diaper_suppository_dose_mg INTEGER;

ALTER TABLE public.baby_care_entries
  DROP CONSTRAINT IF EXISTS bce_diaper_fever_requires_temperature;

ALTER TABLE public.baby_care_entries
  ADD CONSTRAINT bce_diaper_fever_requires_temperature
  CHECK (
    diaper_fever_measured IS DISTINCT FROM TRUE
    OR diaper_temperature_c IS NOT NULL
  );

ALTER TABLE public.baby_care_entries
  DROP CONSTRAINT IF EXISTS bce_diaper_suppository_requires_dose;

ALTER TABLE public.baby_care_entries
  ADD CONSTRAINT bce_diaper_suppository_requires_dose
  CHECK (
    diaper_suppository_given IS DISTINCT FROM TRUE
    OR diaper_suppository_dose_mg IS NOT NULL
  );

ALTER TABLE public.baby_care_entries
  DROP CONSTRAINT IF EXISTS bce_diaper_temperature_range;

ALTER TABLE public.baby_care_entries
  ADD CONSTRAINT bce_diaper_temperature_range
  CHECK (
    diaper_temperature_c IS NULL
    OR (diaper_temperature_c >= 30 AND diaper_temperature_c <= 45)
  );

ALTER TABLE public.baby_care_entries
  DROP CONSTRAINT IF EXISTS bce_diaper_suppository_dose_positive;

ALTER TABLE public.baby_care_entries
  ADD CONSTRAINT bce_diaper_suppository_dose_positive
  CHECK (
    diaper_suppository_dose_mg IS NULL
    OR diaper_suppository_dose_mg > 0
  );
