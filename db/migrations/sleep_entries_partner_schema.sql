-- Migration: Von shared_with_user_id zu partner_id
-- Diese Migration ändert das Datenmodell für bessere Synchronisierung zwischen Partnern

-- 1. Füge partner_id Spalte hinzu (falls sie noch nicht existiert)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sleep_entries' AND column_name = 'partner_id') THEN
    ALTER TABLE sleep_entries
      ADD COLUMN partner_id uuid;
    RAISE NOTICE 'partner_id Spalte hinzugefügt';
  ELSE
    RAISE NOTICE 'partner_id Spalte existiert bereits';
  END IF;
  
  -- Da es Probleme mit den Referenzen gibt, lassen wir den Foreign Key weg
  -- und vertrauen auf die Anwendungslogik für die Integrität
  -- Der Foreign Key könnte später hinzugefügt werden, wenn die Schema-Beziehungen korrekt sind
  
  -- IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
  --               WHERE constraint_name = 'fk_partner' AND table_name = 'sleep_entries') THEN
  --   ALTER TABLE sleep_entries
  --     ADD CONSTRAINT fk_partner FOREIGN KEY (partner_id) REFERENCES profiles (id);
  -- END IF;
END
$$;

-- 2. Erstelle uniquen Index für Duplikatprävention (falls er noch nicht existiert)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'uniq_duo' AND table_name = 'sleep_entries') THEN
    ALTER TABLE sleep_entries
      ADD CONSTRAINT uniq_duo UNIQUE (user_id, partner_id, start_time);
  END IF;
END
$$;
  
-- 3. Erstelle Row-Level Security Policy für gemeinsamen Zugriff (falls sie noch nicht existiert)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sleep_duo_rw') THEN
    CREATE POLICY sleep_duo_rw
    ON sleep_entries
    FOR ALL
    USING (
          (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = user_id
       OR (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = partner_id
    )
    WITH CHECK (
          (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = user_id
       OR (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = partner_id
    );
  ELSE
    -- Wenn die Policy bereits existiert, vorsichtshalber aktualisieren
    DROP POLICY IF EXISTS sleep_duo_rw ON sleep_entries;
    CREATE POLICY sleep_duo_rw
    ON sleep_entries
    FOR ALL
    USING (
          (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = user_id
       OR (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = partner_id
    )
    WITH CHECK (
          (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = user_id
       OR (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid = partner_id
    );
  END IF;
END
$$;

-- 4. Migriere Daten aus vorhandenen Verbindungen

-- 4.1. Zuerst die shared_with_user_id-Einträge zu partner_id migrieren
UPDATE sleep_entries
SET partner_id = shared_with_user_id
WHERE shared_with_user_id IS NOT NULL;

-- 4.2. Dann für alle Einträge ohne partner_id versuchen, die Partner aus account_links zu ermitteln
WITH user_partners AS (
  SELECT 
    creator_id AS user_id, 
    invited_id AS partner_id
  FROM account_links 
  WHERE status = 'accepted'
  UNION
  SELECT 
    invited_id AS user_id, 
    creator_id AS partner_id
  FROM account_links 
  WHERE status = 'accepted'
)
UPDATE sleep_entries se
SET partner_id = up.partner_id
FROM user_partners up
WHERE se.user_id = up.user_id
AND se.partner_id IS NULL;

-- 4.3. Wenn alle Daten migriert wurden, können wir später die alte Spalte entfernen
-- ALTER TABLE sleep_entries DROP COLUMN shared_with_user_id;

-- 5. Füge updated_by Spalte hinzu, um zu verfolgen, wer den Eintrag zuletzt bearbeitet hat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sleep_entries' AND column_name = 'updated_by') THEN
    ALTER TABLE sleep_entries
      ADD COLUMN updated_by uuid;
  END IF;
END
$$;

-- 6. Funktion: Bestehende Einträge des Einladenden mit neuem Partner verknüpfen
DROP FUNCTION IF EXISTS sync_sleep_entries_for_partner(UUID, UUID);

CREATE OR REPLACE FUNCTION sync_sleep_entries_for_partner(
  p_inviter UUID, -- Nutzer, der eingeladen hat (owner der Einträge)
  p_partner UUID  -- Neuer Partner (eingeladener Nutzer)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INT := 0;
BEGIN
  -- Setze partner_id für alle Einträge des Einladenden, sofern noch nicht (korrekt) gesetzt
  UPDATE sleep_entries se
    SET partner_id = p_partner,
        shared_with_user_id = NULL, -- Legacy-Feld aufräumen
        updated_by = p_partner
  WHERE se.user_id = p_inviter
    AND (se.partner_id IS NULL OR se.partner_id = se.shared_with_user_id OR se.partner_id = p_inviter)
    AND NOT EXISTS (
      SELECT 1
      FROM sleep_entries sx
      WHERE sx.user_id = se.user_id
        AND sx.partner_id = p_partner
        AND sx.start_time = se.start_time
        AND sx.id <> se.id
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', TRUE,
    'updated', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sync_sleep_entries_for_partner(UUID, UUID) TO authenticated;
