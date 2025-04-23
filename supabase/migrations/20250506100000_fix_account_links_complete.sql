-- Umfassendes Skript zur Behebung von Problemen mit der account_links-Tabelle
-- Dieses Skript sollte in der Supabase SQL-Konsole ausgeführt werden

-- 1. Sicherstellen, dass die Tabelle existiert und die richtige Struktur hat
DO $$
BEGIN
    -- Prüfen, ob die Tabelle existiert
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'account_links') THEN
        -- Tabelle erstellen, falls sie nicht existiert
        CREATE TABLE public.account_links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            invited_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            invitation_code TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
            accepted_at TIMESTAMPTZ,
            relationship_type TEXT NOT NULL DEFAULT 'partner'
        );

        -- Kommentar zur Tabelle hinzufügen
        COMMENT ON TABLE public.account_links IS 'Tabelle für Verknüpfungen zwischen Benutzerkonten';
    ELSE
        -- Sicherstellen, dass alle erforderlichen Spalten existieren
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_links' AND column_name = 'invitation_code') THEN
            ALTER TABLE public.account_links ADD COLUMN invitation_code TEXT NOT NULL DEFAULT 'LEGACY';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_links' AND column_name = 'status') THEN
            ALTER TABLE public.account_links ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_links' AND column_name = 'expires_at') THEN
            ALTER TABLE public.account_links ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days');
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_links' AND column_name = 'accepted_at') THEN
            ALTER TABLE public.account_links ADD COLUMN accepted_at TIMESTAMPTZ;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_links' AND column_name = 'relationship_type') THEN
            ALTER TABLE public.account_links ADD COLUMN relationship_type TEXT NOT NULL DEFAULT 'partner';
        END IF;
    END IF;
END
$$;

-- 2. Indizes für bessere Leistung hinzufügen
DO $$
BEGIN
    -- Index für invitation_code (für schnelle Suche)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'account_links'
        AND indexname = 'account_links_invitation_code_idx'
    ) THEN
        CREATE INDEX account_links_invitation_code_idx ON public.account_links (invitation_code);
    END IF;

    -- Index für creator_id (für schnelle Suche nach Einladungen eines Benutzers)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'account_links'
        AND indexname = 'account_links_creator_id_idx'
    ) THEN
        CREATE INDEX account_links_creator_id_idx ON public.account_links (creator_id);
    END IF;

    -- Index für invited_id (für schnelle Suche nach Einladungen für einen Benutzer)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'account_links'
        AND indexname = 'account_links_invited_id_idx'
    ) THEN
        CREATE INDEX account_links_invited_id_idx ON public.account_links (invited_id);
    END IF;

    -- Index für status (für schnelle Suche nach ausstehenden Einladungen)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'account_links'
        AND indexname = 'account_links_status_idx'
    ) THEN
        CREATE INDEX account_links_status_idx ON public.account_links (status);
    END IF;
END
$$;

-- 3. RLS aktivieren und Richtlinien aktualisieren
-- RLS für die Tabelle aktivieren
ALTER TABLE public.account_links ENABLE ROW LEVEL SECURITY;

-- Alle bestehenden Richtlinien löschen
DROP POLICY IF EXISTS "Users can view their own account links" ON public.account_links;
DROP POLICY IF EXISTS "Users can create invitation links" ON public.account_links;
DROP POLICY IF EXISTS "Users can update their own account links" ON public.account_links;
DROP POLICY IF EXISTS "Users can update account links with invitation code" ON public.account_links;
DROP POLICY IF EXISTS "Users can view pending invitations" ON public.account_links;

-- Neue Richtlinien erstellen
-- SELECT-Richtlinie: Benutzer können ihre eigenen Verknüpfungen und ausstehende Einladungen sehen
CREATE POLICY "Users can view their own account links"
ON public.account_links
FOR SELECT
USING (
  auth.uid() = creator_id OR
  auth.uid() = invited_id OR
  (status = 'pending')
);

-- INSERT-Richtlinie: Benutzer können Einladungen erstellen
CREATE POLICY "Users can create invitation links"
ON public.account_links
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- UPDATE-Richtlinie: Benutzer können ihre eigenen Verknüpfungen aktualisieren
-- WICHTIG: Diese Richtlinie erlaubt auch das Aktualisieren von ausstehenden Einladungen
CREATE POLICY "Users can update account links with invitation code"
ON public.account_links
FOR UPDATE
USING (
  auth.uid() = creator_id OR
  auth.uid() = invited_id OR
  (invited_id IS NULL AND status = 'pending')
);

-- Richtlinie für das Löschen von Einladungen
CREATE POLICY "Users can delete their own invitations"
ON public.account_links
FOR DELETE
USING (auth.uid() = creator_id);

-- 4. RPC-Funktionen für direktes SQL-Update erstellen oder aktualisieren
-- Funktion zum Akzeptieren einer Einladung
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_id UUID, user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Prüfen, ob die Einladung existiert und gültig ist
  IF NOT EXISTS (
    SELECT 1 FROM public.account_links
    WHERE id = invitation_id
    AND status = 'pending'
    AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Einladung nicht gefunden oder ungültig');
  END IF;

  -- Prüfen, ob der Benutzer versucht, seine eigene Einladung anzunehmen
  IF EXISTS (
    SELECT 1 FROM public.account_links
    WHERE id = invitation_id
    AND creator_id = user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sie können Ihre eigene Einladung nicht annehmen');
  END IF;

  -- Aktualisieren der Einladung
  UPDATE public.account_links
  SET
    invited_id = user_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = invitation_id
  RETURNING to_jsonb(account_links.*) INTO result;

  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'data', result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.accept_invitation IS 'Akzeptiert eine Einladung und setzt den eingeladenen Benutzer, umgeht RLS-Richtlinien';

-- Funktion zum direkten SQL-Update von Einladungen
CREATE OR REPLACE FUNCTION public.direct_update_invitation(p_invitation_id UUID, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_result jsonb;
  v_invitation_exists boolean;
  v_is_own_invitation boolean;
  v_is_expired boolean;
  v_is_pending boolean;
BEGIN
  -- Prüfen, ob die Einladung existiert
  SELECT EXISTS(SELECT 1 FROM public.account_links WHERE id = p_invitation_id) INTO v_invitation_exists;

  IF NOT v_invitation_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Einladung nicht gefunden');
  END IF;

  -- Prüfen, ob der Benutzer versucht, seine eigene Einladung anzunehmen
  SELECT EXISTS(SELECT 1 FROM public.account_links WHERE id = p_invitation_id AND creator_id = p_user_id)
  INTO v_is_own_invitation;

  IF v_is_own_invitation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sie können Ihre eigene Einladung nicht annehmen');
  END IF;

  -- Prüfen, ob die Einladung abgelaufen ist
  SELECT EXISTS(SELECT 1 FROM public.account_links WHERE id = p_invitation_id AND expires_at <= NOW())
  INTO v_is_expired;

  IF v_is_expired THEN
    RETURN jsonb_build_object('success', false, 'error', 'Diese Einladung ist abgelaufen');
  END IF;

  -- Prüfen, ob die Einladung noch ausstehend ist
  SELECT EXISTS(SELECT 1 FROM public.account_links WHERE id = p_invitation_id AND status = 'pending')
  INTO v_is_pending;

  IF NOT v_is_pending THEN
    RETURN jsonb_build_object('success', false, 'error', 'Diese Einladung wurde bereits verwendet');
  END IF;

  -- Aktualisieren der Einladung mit direktem SQL
  UPDATE public.account_links
  SET
    invited_id = p_user_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = p_invitation_id;

  -- Abrufen der aktualisierten Daten
  SELECT to_jsonb(account_links.*) INTO v_result
  FROM public.account_links
  WHERE id = p_invitation_id;

  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.direct_update_invitation IS 'Aktualisiert eine Einladung direkt mit SQL, umgeht RLS-Richtlinien';

-- 5. Funktion zum Einlösen eines Einladungscodes über den Code (nicht die ID)
CREATE OR REPLACE FUNCTION public.redeem_invitation_by_code(p_invitation_code TEXT, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_invitation_id UUID;
  v_result jsonb;
  v_is_own_invitation boolean;
  v_is_expired boolean;
  v_is_pending boolean;
  v_creator_id UUID;
  v_code_exists boolean;
BEGIN
  -- Prüfen, ob der Einladungscode existiert (case-insensitive)
  SELECT EXISTS(
    SELECT 1 FROM public.account_links
    WHERE LOWER(invitation_code) = LOWER(p_invitation_code)
  ) INTO v_code_exists;

  IF NOT v_code_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Einladungscode nicht gefunden');
  END IF;

  -- Exakte Suche nach dem Code
  SELECT id, creator_id INTO v_invitation_id, v_creator_id
  FROM public.account_links
  WHERE LOWER(invitation_code) = LOWER(p_invitation_code);

  -- Protokollieren der gefundenen Einladung
  RAISE NOTICE 'Einladung gefunden: ID=%, Creator=%, Code=%', v_invitation_id, v_creator_id, p_invitation_code;

  -- Prüfen, ob der Benutzer versucht, seine eigene Einladung anzunehmen
  IF v_creator_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sie können Ihre eigene Einladung nicht annehmen');
  END IF;

  -- Prüfen, ob die Einladung abgelaufen ist
  SELECT EXISTS(SELECT 1 FROM public.account_links WHERE id = v_invitation_id AND expires_at <= NOW())
  INTO v_is_expired;

  IF v_is_expired THEN
    RETURN jsonb_build_object('success', false, 'error', 'Diese Einladung ist abgelaufen');
  END IF;

  -- Prüfen, ob die Einladung noch ausstehend ist
  SELECT EXISTS(SELECT 1 FROM public.account_links WHERE id = v_invitation_id AND status = 'pending')
  INTO v_is_pending;

  IF NOT v_is_pending THEN
    RETURN jsonb_build_object('success', false, 'error', 'Diese Einladung wurde bereits verwendet');
  END IF;

  -- Aktualisieren der Einladung mit direktem SQL
  UPDATE public.account_links
  SET
    invited_id = p_user_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invitation_id;

  -- Abrufen der aktualisierten Daten
  SELECT to_jsonb(account_links.*) INTO v_result
  FROM public.account_links
  WHERE id = v_invitation_id;

  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.redeem_invitation_by_code IS 'Löst einen Einladungscode ein und aktualisiert die Einladung, umgeht RLS-Richtlinien';

-- 6. Debugging-Funktion zum Anzeigen aller Einladungen
CREATE OR REPLACE FUNCTION public.debug_list_all_invitations()
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  invited_id UUID,
  invitation_code TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  relationship_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.creator_id,
    a.invited_id,
    a.invitation_code,
    a.status,
    a.created_at,
    a.expires_at,
    a.accepted_at,
    a.relationship_type
  FROM
    public.account_links a
  ORDER BY
    a.created_at DESC;
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.debug_list_all_invitations IS 'Listet alle Einladungen für Debugging-Zwecke auf, umgeht RLS-Richtlinien';

-- 7. Debugging-Funktion zum Suchen nach einem Einladungscode
CREATE OR REPLACE FUNCTION public.debug_find_invitation_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  invited_id UUID,
  invitation_code TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  relationship_type TEXT,
  exact_match BOOLEAN,
  case_insensitive_match BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.creator_id,
    a.invited_id,
    a.invitation_code,
    a.status,
    a.created_at,
    a.expires_at,
    a.accepted_at,
    a.relationship_type,
    a.invitation_code = p_code AS exact_match,
    LOWER(a.invitation_code) = LOWER(p_code) AS case_insensitive_match
  FROM
    public.account_links a
  WHERE
    a.invitation_code = p_code
    OR LOWER(a.invitation_code) = LOWER(p_code)
  ORDER BY
    a.created_at DESC;
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.debug_find_invitation_code IS 'Sucht nach einem Einladungscode für Debugging-Zwecke, umgeht RLS-Richtlinien';

-- 8. Funktion zum Zurücksetzen einer Einladung (für Testzwecke)
CREATE OR REPLACE FUNCTION public.debug_reset_invitation(p_invitation_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Zurücksetzen der Einladung
  UPDATE public.account_links
  SET
    invited_id = NULL,
    status = 'pending',
    accepted_at = NULL
  WHERE id = p_invitation_id
  RETURNING to_jsonb(account_links.*) INTO v_result;

  -- Erfolg zurückgeben
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.debug_reset_invitation IS 'Setzt eine Einladung zurück (für Testzwecke), umgeht RLS-Richtlinien';

-- 9. Trigger für Logging von Änderungen an account_links
CREATE TABLE IF NOT EXISTS public.account_links_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS für die Audit-Log-Tabelle deaktivieren (nur für Administratoren zugänglich)
ALTER TABLE public.account_links_audit_log DISABLE ROW LEVEL SECURITY;

-- Trigger-Funktion erstellen
CREATE OR REPLACE FUNCTION public.account_links_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.account_links_audit_log (action, record_id, new_data, changed_by)
    VALUES ('INSERT', NEW.id, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.account_links_audit_log (action, record_id, old_data, new_data, changed_by)
    VALUES ('UPDATE', NEW.id, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.account_links_audit_log (action, record_id, old_data, changed_by)
    VALUES ('DELETE', OLD.id, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger erstellen
DROP TRIGGER IF EXISTS account_links_audit_trigger ON public.account_links;
CREATE TRIGGER account_links_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.account_links
FOR EACH ROW EXECUTE FUNCTION public.account_links_audit_trigger();

-- 10. Testdaten einfügen (optional, nur für Testzwecke)
-- Kommentieren Sie diesen Abschnitt aus, wenn Sie keine Testdaten einfügen möchten
/*
INSERT INTO public.account_links (creator_id, invitation_code, status, expires_at, relationship_type)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'TEST1234', 'pending', NOW() + INTERVAL '7 days', 'partner'),
  ('00000000-0000-0000-0000-000000000001', 'TEST5678', 'pending', NOW() + INTERVAL '7 days', 'family');
*/

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Skript erfolgreich ausgeführt. Die account_links-Tabelle und alle zugehörigen Funktionen wurden aktualisiert.';
END
$$;
