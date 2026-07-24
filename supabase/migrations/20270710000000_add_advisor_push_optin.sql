-- ============================================================
-- Lottis Fürsorge — explizites Push-Opt-in
--
-- Push-Hinweise werden nur noch versendet, wenn der Nutzer sie in
-- den Fürsorge-Einstellungen aktiv eingeschaltet hat (Default AUS).
-- advisor-daily prüft push_enabled vor jedem Expo-Push.
-- Idempotent — mehrfaches Ausführen ist harmlos.
-- ============================================================

ALTER TABLE public.advisor_settings
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT FALSE;
