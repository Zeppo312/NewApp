ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS community_identity_mode TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_community_identity_mode_check'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_community_identity_mode_check
      CHECK (community_identity_mode IN ('username', 'real_name'));
  END IF;
END
$$;

COMMENT ON COLUMN public.user_settings.community_identity_mode IS
  'Legt fest, ob die Nutzerin in der Community per Username oder mit Vor- und Nachnamen auftritt.';
