-- Benutzerdefinierte Daily-Aktivitaeten, Phase 3: FK-Index ohne Schreibsperre.
-- Diese Datei muss ueber die aktuelle Supabase CLI ausgefuehrt werden.

CREATE INDEX CONCURRENTLY baby_care_entries_custom_activity_baby_idx
  ON public.baby_care_entries(custom_activity_type_id, baby_id)
  WHERE custom_activity_type_id IS NOT NULL;
