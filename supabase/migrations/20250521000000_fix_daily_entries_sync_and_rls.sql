-- Migration zur Behebung von Problemen mit der Synchronisierung von Alltag-Einträgen
-- und Erweiterung der RLS-Policies für verbundene Benutzer

-- 1. Erweitern der RLS-Policies für die baby_daily Tabelle

-- Löschen der bestehenden Policies
DROP POLICY IF EXISTS "Users can view their own daily entries" ON public.baby_daily;
DROP POLICY IF EXISTS "Users can insert their own daily entries" ON public.baby_daily;
DROP POLICY IF EXISTS "Users can update their own daily entries" ON public.baby_daily;
DROP POLICY IF EXISTS "Users can delete their own daily entries" ON public.baby_daily;

-- Neue Policy für das Anzeigen von Einträgen: Eigene Einträge und Einträge von verbundenen Benutzern
CREATE POLICY "Users can view their own and linked users daily entries" 
ON public.baby_daily
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 
    FROM public.account_links al 
    WHERE (al.creator_id = auth.uid() AND al.invited_id = user_id AND al.status = 'accepted') OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id AND al.status = 'accepted')
  )
);

-- Neue Policy für das Einfügen von Einträgen: Nur eigene Einträge
CREATE POLICY "Users can insert their own daily entries" 
ON public.baby_daily
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Neue Policy für das Aktualisieren von Einträgen: Eigene Einträge
CREATE POLICY "Users can update their own daily entries" 
ON public.baby_daily
FOR UPDATE 
USING (auth.uid() = user_id);

-- Neue Policy für das Löschen von Einträgen: Eigene Einträge
CREATE POLICY "Users can delete their own daily entries" 
ON public.baby_daily
FOR DELETE 
USING (auth.uid() = user_id);

-- 2. Aktualisieren der Synchronisierungsfunktionen für bidirektionale Synchronisierung

-- Aktualisierte Funktion zum Hinzufügen eines Alltag-Eintrags und Synchronisieren mit allen verknüpften Benutzern
CREATE OR REPLACE FUNCTION public.add_daily_entry_and_sync(
  p_user_id UUID,
  p_entry_date TIMESTAMPTZ,
  p_entry_type TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_entry_id UUID;
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT 
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
  v_linked_users jsonb := '[]'::jsonb;
  v_synced_count INTEGER := 0;
BEGIN
  -- Deaktiviere die Trigger temporär, um Rekursion zu vermeiden
  PERFORM public.disable_daily_sync_triggers();
  
  -- Hinzufügen des Eintrags für den Benutzer
  INSERT INTO public.baby_daily (
    user_id,
    entry_date,
    entry_type,
    start_time,
    end_time,
    notes,
    created_at,
    updated_at,
    is_syncing
  ) VALUES (
    p_user_id,
    p_entry_date,
    p_entry_type,
    p_start_time,
    p_end_time,
    p_notes,
    NOW(),
    NOW(),
    FALSE
  ) RETURNING id INTO v_entry_id;
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id;
    EXIT WHEN NOT FOUND;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Hinzufügen des Eintrags für den verknüpften Benutzer
    INSERT INTO public.baby_daily (
      user_id,
      entry_date,
      entry_type,
      start_time,
      end_time,
      notes,
      created_at,
      updated_at,
      is_syncing
    ) VALUES (
      v_linked_user_id,
      p_entry_date,
      p_entry_type,
      p_start_time,
      p_end_time,
      p_notes,
      NOW(),
      NOW(),
      TRUE
    );
    
    v_synced_count := v_synced_count + 1;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Aktiviere die Trigger wieder
  PERFORM public.enable_daily_sync_triggers();
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'entryId', v_entry_id,
    'synced', v_synced_count > 0,
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Aktualisierte Funktion zum Synchronisieren aller bestehenden Alltag-Einträge
CREATE OR REPLACE FUNCTION public.sync_all_existing_daily_entries(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Wird mit den Rechten des Erstellers ausgeführt, umgeht RLS
AS $$
DECLARE
  v_linked_user_id UUID;
  v_linked_users_cursor CURSOR FOR
    SELECT 
      CASE
        WHEN al.creator_id = p_user_id THEN al.invited_id
        ELSE al.creator_id
      END AS linked_user_id,
      CASE
        WHEN al.creator_id = p_user_id THEN true
        ELSE false
      END AS is_inviter
    FROM 
      public.account_links al
    WHERE 
      (al.creator_id = p_user_id OR al.invited_id = p_user_id)
      AND al.status = 'accepted';
  v_is_inviter BOOLEAN;
  v_linked_users jsonb := '[]'::jsonb;
  v_synced_count INTEGER := 0;
  v_my_entries RECORD;
  v_their_entries RECORD;
BEGIN
  -- Deaktiviere die Trigger temporär, um Rekursion zu vermeiden
  PERFORM public.disable_daily_sync_triggers();
  
  -- Für jeden verknüpften Benutzer
  OPEN v_linked_users_cursor;
  LOOP
    FETCH v_linked_users_cursor INTO v_linked_user_id, v_is_inviter;
    EXIT WHEN NOT FOUND;
    
    -- Abrufen der Profilinformationen des verknüpften Benutzers
    SELECT 
      v_linked_users || jsonb_build_object(
        'userId', p.id,
        'firstName', p.first_name,
        'lastName', p.last_name,
        'userRole', p.user_role
      ) INTO v_linked_users
    FROM 
      public.profiles p
    WHERE 
      p.id = v_linked_user_id;
    
    -- Bidirektionale Synchronisierung: Einträge in beide Richtungen synchronisieren
    
    -- 1. Einträge vom aktuellen Benutzer zum verknüpften Benutzer kopieren
    FOR v_my_entries IN 
      SELECT * FROM public.baby_daily WHERE user_id = p_user_id
    LOOP
      -- Prüfen, ob der Eintrag bereits beim verknüpften Benutzer existiert
      IF NOT EXISTS (
        SELECT 1 FROM public.baby_daily 
        WHERE user_id = v_linked_user_id 
          AND entry_date = v_my_entries.entry_date 
          AND entry_type = v_my_entries.entry_type
      ) THEN
        -- Eintrag beim verknüpften Benutzer erstellen
        INSERT INTO public.baby_daily (
          user_id,
          entry_date,
          entry_type,
          start_time,
          end_time,
          notes,
          created_at,
          updated_at,
          is_syncing
        ) VALUES (
          v_linked_user_id,
          v_my_entries.entry_date,
          v_my_entries.entry_type,
          v_my_entries.start_time,
          v_my_entries.end_time,
          v_my_entries.notes,
          NOW(),
          NOW(),
          TRUE
        );
        
        v_synced_count := v_synced_count + 1;
      END IF;
    END LOOP;
    
    -- 2. Einträge vom verknüpften Benutzer zum aktuellen Benutzer kopieren
    FOR v_their_entries IN 
      SELECT * FROM public.baby_daily WHERE user_id = v_linked_user_id
    LOOP
      -- Prüfen, ob der Eintrag bereits beim aktuellen Benutzer existiert
      IF NOT EXISTS (
        SELECT 1 FROM public.baby_daily 
        WHERE user_id = p_user_id 
          AND entry_date = v_their_entries.entry_date 
          AND entry_type = v_their_entries.entry_type
      ) THEN
        -- Eintrag beim aktuellen Benutzer erstellen
        INSERT INTO public.baby_daily (
          user_id,
          entry_date,
          entry_type,
          start_time,
          end_time,
          notes,
          created_at,
          updated_at,
          is_syncing
        ) VALUES (
          p_user_id,
          v_their_entries.entry_date,
          v_their_entries.entry_type,
          v_their_entries.start_time,
          v_their_entries.end_time,
          v_their_entries.notes,
          NOW(),
          NOW(),
          TRUE
        );
        
        v_synced_count := v_synced_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  CLOSE v_linked_users_cursor;
  
  -- Aktiviere die Trigger wieder
  PERFORM public.enable_daily_sync_triggers();
  
  -- Erfolg zurückgeben mit Synchronisierungsinformationen
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Alltag-Einträge wurden bidirektional synchronisiert',
    'syncedCount', v_synced_count,
    'linkedUsers', v_linked_users
  );
END;
$$;

-- Kommentar zur Erklärung
COMMENT ON FUNCTION public.sync_all_existing_daily_entries IS 'Synchronisiert alle bestehenden Alltag-Einträge bidirektional zwischen verknüpften Benutzern';
COMMENT ON FUNCTION public.add_daily_entry_and_sync IS 'Fügt einen Alltag-Eintrag hinzu und synchronisiert ihn mit allen verknüpften Benutzern';

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE 'Migration erfolgreich ausgeführt. Die RLS-Policies für baby_daily wurden erweitert und die Synchronisierungsfunktionen wurden aktualisiert.';
END
$$;
