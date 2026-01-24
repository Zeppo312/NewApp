-- Paywall-Felder an user_settings anhängen
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paywall_last_shown_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_settings.is_pro IS 'Kennzeichnet Pro-User (z.B. durch Abo)';
COMMENT ON COLUMN public.user_settings.paywall_last_shown_at IS 'Letzte Anzeige der Paywall (für 2h-Cooldown)';
