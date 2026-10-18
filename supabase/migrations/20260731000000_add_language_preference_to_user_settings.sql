ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS language_preference TEXT NOT NULL DEFAULT 'system';

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_language_preference_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_language_preference_check
  CHECK (language_preference IN ('system', 'de', 'en', 'es'));

COMMENT ON COLUMN public.user_settings.language_preference IS
  'Preferred app language. System resolves from the current device or per-app language.';

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS resolved_language TEXT NOT NULL DEFAULT 'de';

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_resolved_language_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_resolved_language_check
  CHECK (resolved_language IN ('de', 'en', 'es'));

COMMENT ON COLUMN public.user_settings.resolved_language IS
  'Currently resolved app language, used by server-side notifications.';
