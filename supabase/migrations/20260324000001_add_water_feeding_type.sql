ALTER TABLE public.baby_care_entries
DROP CONSTRAINT IF EXISTS baby_care_entries_feeding_type_check;

ALTER TABLE public.baby_care_entries
ADD CONSTRAINT baby_care_entries_feeding_type_check
CHECK (feeding_type IN ('BREAST', 'BOTTLE', 'SOLIDS', 'PUMP', 'WATER'));
