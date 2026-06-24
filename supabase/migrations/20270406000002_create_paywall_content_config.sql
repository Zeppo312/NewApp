CREATE TABLE IF NOT EXISTS public.paywall_content_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT paywall_content_config_singleton CHECK (id = 'default')
);

ALTER TABLE public.paywall_content_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view paywall content config" ON public.paywall_content_config;
CREATE POLICY "Public can view paywall content config"
  ON public.paywall_content_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert paywall content config" ON public.paywall_content_config;
CREATE POLICY "Admins can insert paywall content config"
  ON public.paywall_content_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = TRUE
    )
  );

DROP POLICY IF EXISTS "Admins can update paywall content config" ON public.paywall_content_config;
CREATE POLICY "Admins can update paywall content config"
  ON public.paywall_content_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = TRUE
    )
  );

CREATE OR REPLACE FUNCTION public.update_paywall_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_paywall_content_updated_at ON public.paywall_content_config;
CREATE TRIGGER set_paywall_content_updated_at
  BEFORE UPDATE ON public.paywall_content_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_paywall_content_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'paywall_content_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.paywall_content_config;
  END IF;
END $$;

INSERT INTO public.paywall_content_config (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.paywall_content_config IS
  'Globale, von Admins pflegbare Texte fuer die Paywall.';
