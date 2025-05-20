-- Neuer Ansatz: Separate Tabelle für geteilte Einträge statt direkter Spalte

-- 1. Neue Tabelle für geteilte Einträge erstellen
CREATE TABLE IF NOT EXISTS sleep_entry_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES sleep_entries(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  shared_with_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Verhindert doppelte Freigaben
  CONSTRAINT unique_share UNIQUE(entry_id, shared_with_id),
  
  -- Verhindert Selbst-Teilen
  CONSTRAINT prevent_self_share CHECK (owner_id != shared_with_id)
);

-- 2. RLS aktivieren und sichere Standardrichtlinie
ALTER TABLE sleep_entry_shares ENABLE ROW LEVEL SECURITY;

-- 3. Richtlinien für die neue Tabelle (zuerst alte löschen, falls vorhanden)
-- Lösche vorhandene Richtlinien
DROP POLICY IF EXISTS manage_own_shares ON sleep_entry_shares;
DROP POLICY IF EXISTS view_shared_with_me ON sleep_entry_shares;

-- Eigentümer kann Freigaben sehen und verwalten
CREATE POLICY manage_own_shares ON sleep_entry_shares
  FOR ALL TO authenticated
  USING (owner_id = auth.uid());

-- Benutzer können Einträge sehen, die mit ihnen geteilt wurden
CREATE POLICY view_shared_with_me ON sleep_entry_shares
  FOR SELECT TO authenticated
  USING (shared_with_id = auth.uid());

-- 4. Funktion zum einfachen Teilen von Einträgen
DROP FUNCTION IF EXISTS share_sleep_entry_v2(UUID, UUID);

CREATE OR REPLACE FUNCTION share_sleep_entry_v2(
  p_entry_id UUID,
  p_partner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_result JSONB;
BEGIN
  -- Prüfe, ob der Eintrag existiert und hole den Besitzer
  SELECT user_id INTO v_owner_id 
  FROM sleep_entries 
  WHERE id = p_entry_id;
  
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Eintrag nicht gefunden'
    );
  END IF;
  
  -- Prüfe, ob der aktuelle Benutzer der Besitzer ist
  IF v_owner_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Keine Berechtigung zum Teilen dieses Eintrags'
    );
  END IF;
  
  -- Prüfe, ob Selbst-Teilen versucht wird
  IF auth.uid() = p_partner_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Eintrag kann nicht mit dir selbst geteilt werden'
    );
  END IF;
  
  -- Versuche den Eintrag zu teilen
  BEGIN
    INSERT INTO sleep_entry_shares 
      (entry_id, owner_id, shared_with_id)
    VALUES 
      (p_entry_id, auth.uid(), p_partner_id);
      
    v_result := jsonb_build_object(
      'success', TRUE,
      'message', 'Eintrag erfolgreich geteilt'
    );
  EXCEPTION 
    WHEN unique_violation THEN
      v_result := jsonb_build_object(
        'success', TRUE,
        'message', 'Eintrag war bereits geteilt'
      );
    WHEN OTHERS THEN
      v_result := jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM
      );
  END;
  
  RETURN v_result;
END;
$$;

-- 5. Funktion zum Aufheben der Freigabe
DROP FUNCTION IF EXISTS unshare_sleep_entry_v2(UUID, UUID);

CREATE OR REPLACE FUNCTION unshare_sleep_entry_v2(
  p_entry_id UUID,
  p_partner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_where TEXT;
BEGIN
  -- Lösche alle Freigaben, wenn kein Partner angegeben
  IF p_partner_id IS NULL THEN
    DELETE FROM sleep_entry_shares
    WHERE entry_id = p_entry_id
      AND owner_id = auth.uid();
  ELSE
    -- Sonst nur die spezifische Freigabe löschen
    DELETE FROM sleep_entry_shares
    WHERE entry_id = p_entry_id
      AND owner_id = auth.uid()
      AND shared_with_id = p_partner_id;
  END IF;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'count', v_count,
    'message', v_count || ' Freigaben wurden aufgehoben'
  );
END;
$$;

-- 6. Funktion zum Laden von Einträgen (eigene + geteilte)
DROP FUNCTION IF EXISTS get_all_visible_sleep_entries();

CREATE OR REPLACE FUNCTION get_all_visible_sleep_entries()
RETURNS SETOF sleep_entries
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Eigene Einträge
  SELECT se.* FROM sleep_entries se
  WHERE se.user_id = auth.uid()
  
  UNION
  
  -- Mit mir geteilte Einträge
  SELECT se.* FROM sleep_entries se
  JOIN sleep_entry_shares ses ON se.id = ses.entry_id
  WHERE ses.shared_with_id = auth.uid()
  
  ORDER BY start_time DESC;
$$;

-- 7. Freigeben für Benutzer
GRANT EXECUTE ON FUNCTION share_sleep_entry_v2(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unshare_sleep_entry_v2(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_visible_sleep_entries() TO authenticated;

-- 8. Migrationsfunktion: Existierende geteilte Einträge in die neue Tabelle verschieben
DROP FUNCTION IF EXISTS migrate_existing_shared_entries();

CREATE OR REPLACE FUNCTION migrate_existing_shared_entries()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_entry RECORD;
BEGIN
  -- Alle Einträge mit shared_with_user_id durchgehen
  FOR v_entry IN (
    SELECT id, user_id, shared_with_user_id 
    FROM sleep_entries 
    WHERE shared_with_user_id IS NOT NULL
      AND user_id != shared_with_user_id
  ) LOOP
    BEGIN
      -- In die neue Tabelle einfügen
      INSERT INTO sleep_entry_shares 
        (entry_id, owner_id, shared_with_id)
      VALUES 
        (v_entry.id, v_entry.user_id, v_entry.shared_with_user_id);
        
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Fehler ignorieren und weitermachen
      NULL;
    END;
  END LOOP;
  
  -- Migration-Statistik zurückgeben
  RETURN jsonb_build_object(
    'success', TRUE,
    'migrated', v_count
  );
END;
$$; 