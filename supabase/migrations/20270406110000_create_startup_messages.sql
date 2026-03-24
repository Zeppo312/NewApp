CREATE TABLE IF NOT EXISTS public.startup_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  content_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  source_url TEXT,
  button_label TEXT NOT NULL DEFAULT 'Okay',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT startup_messages_content_type_check
    CHECK (content_type IN ('text', 'html', 'remote_url')),
  CONSTRAINT startup_messages_payload_check
    CHECK (
      (
        content_type IN ('text', 'html')
        AND NULLIF(BTRIM(COALESCE(content, '')), '') IS NOT NULL
      )
      OR (
        content_type = 'remote_url'
        AND NULLIF(BTRIM(COALESCE(source_url, '')), '') IS NOT NULL
      )
    )
);

CREATE TABLE IF NOT EXISTS public.startup_message_acknowledgements (
  message_id UUID NOT NULL REFERENCES public.startup_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS startup_messages_active_created_idx
  ON public.startup_messages (created_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS startup_message_acknowledgements_user_idx
  ON public.startup_message_acknowledgements (user_id, acknowledged_at DESC);

ALTER TABLE public.startup_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_message_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active startup messages" ON public.startup_messages;
CREATE POLICY "Authenticated users can read active startup messages"
  ON public.startup_messages
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage startup messages" ON public.startup_messages;
CREATE POLICY "Admins can manage startup messages"
  ON public.startup_messages
  FOR ALL
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

DROP POLICY IF EXISTS "Users can read own startup acknowledgements" ON public.startup_message_acknowledgements;
CREATE POLICY "Users can read own startup acknowledgements"
  ON public.startup_message_acknowledgements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own startup acknowledgements" ON public.startup_message_acknowledgements;
CREATE POLICY "Users can insert own startup acknowledgements"
  ON public.startup_message_acknowledgements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage startup acknowledgements" ON public.startup_message_acknowledgements;
CREATE POLICY "Admins can manage startup acknowledgements"
  ON public.startup_message_acknowledgements
  FOR ALL
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

CREATE OR REPLACE FUNCTION public.set_startup_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_startup_message_updated_at ON public.startup_messages;
CREATE TRIGGER set_startup_message_updated_at
  BEFORE UPDATE ON public.startup_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_startup_message_updated_at();

DROP FUNCTION IF EXISTS public.get_pending_startup_message();
CREATE OR REPLACE FUNCTION public.get_pending_startup_message()
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  content_type TEXT,
  content TEXT,
  source_url TEXT,
  button_label TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    message.id,
    message.title,
    message.summary,
    message.content_type,
    message.content,
    message.source_url,
    message.button_label,
    message.created_at,
    message.updated_at
  FROM public.startup_messages AS message
  WHERE message.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM public.startup_message_acknowledgements AS acknowledgement
      WHERE acknowledgement.message_id = message.id
        AND acknowledgement.user_id = auth.uid()
    )
  ORDER BY message.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_pending_startup_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_startup_message() TO authenticated, service_role;

COMMENT ON TABLE public.startup_messages IS
  'Von Admins gepflegte Startmeldungen, die Nutzern nach App-Start einmalig angezeigt werden.';

COMMENT ON TABLE public.startup_message_acknowledgements IS
  'Speichert, welche Startmeldungen ein Nutzer bereits bestaetigt hat.';
