-- Benutzerdefinierte Daily-Aktivitaeten, Phase 2: Altbestand validieren.
-- VALIDATE CONSTRAINT erlaubt normale Lese- und Schreibzugriffe waehrend
-- des Scans und scheitert ohne Datenveraenderung, falls Altbestand abweicht.

SET lock_timeout = '5s';

ALTER TABLE public.baby_care_entries
  VALIDATE CONSTRAINT baby_care_entries_custom_activity_baby_fkey;

ALTER TABLE public.baby_care_entries
  VALIDATE CONSTRAINT baby_care_entries_entry_type_check;

ALTER TABLE public.baby_care_entries
  VALIDATE CONSTRAINT baby_care_entries_custom_tracking_mode_check;

ALTER TABLE public.baby_care_entries
  VALIDATE CONSTRAINT baby_care_entries_custom_quantity_check;

ALTER TABLE public.baby_care_entries
  VALIDATE CONSTRAINT baby_care_entries_custom_snapshot_values_check;

ALTER TABLE public.baby_care_entries
  VALIDATE CONSTRAINT baby_care_entries_custom_payload_check;

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.baby_care_entries'::regclass
      AND conname IN (
        'baby_care_entries_custom_activity_baby_fkey',
        'baby_care_entries_entry_type_check',
        'baby_care_entries_custom_tracking_mode_check',
        'baby_care_entries_custom_quantity_check',
        'baby_care_entries_custom_snapshot_values_check',
        'baby_care_entries_custom_payload_check'
      )
      AND NOT convalidated
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Custom-Daily-Migration abgebrochen: nicht alle Constraints wurden validiert.';
  END IF;
END;
$verify$;

RESET lock_timeout;
