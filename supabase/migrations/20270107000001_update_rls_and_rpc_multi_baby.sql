-- RLS + RPC updates for multi-baby support using baby_members

-- 1) baby_members policies
ALTER TABLE public.baby_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view baby memberships" ON public.baby_members;
CREATE POLICY "Baby members: select by member" ON public.baby_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.baby_members bm
      WHERE bm.baby_id = baby_members.baby_id AND bm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_members.baby_id AND bi.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage baby memberships" ON public.baby_members;
CREATE POLICY "Baby members: insert by owner" ON public.baby_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_id AND bi.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby members: update by owner or self" ON public.baby_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_id AND bi.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_id AND bi.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby members: delete by owner or self" ON public.baby_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_id AND bi.user_id = auth.uid()
    )
  );

-- 1b) Backfill baby_members from accepted account links (partner sharing)
DO $$
BEGIN
  IF to_regclass('public.account_links') IS NOT NULL THEN
    INSERT INTO public.baby_members (baby_id, user_id, role)
    SELECT bi.id, al.invited_id, 'partner'
    FROM public.baby_info bi
    JOIN public.account_links al ON al.creator_id = bi.user_id
    WHERE al.status = 'accepted'
    UNION
    SELECT bi.id, al.creator_id, 'partner'
    FROM public.baby_info bi
    JOIN public.account_links al ON al.invited_id = bi.user_id
    WHERE al.status = 'accepted'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 2) baby_info policies
DROP POLICY IF EXISTS "Users can view their own baby info" ON public.baby_info;
DROP POLICY IF EXISTS "Users can insert their own baby info" ON public.baby_info;
DROP POLICY IF EXISTS "Users can update their own baby info" ON public.baby_info;
DROP POLICY IF EXISTS "Users can delete their own baby info" ON public.baby_info;

CREATE POLICY "Baby info: select by member" ON public.baby_info
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_info.id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby info: insert by owner" ON public.baby_info
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Baby info: update by member" ON public.baby_info
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_info.id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby info: delete by member" ON public.baby_info
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_info.id AND bm.user_id = auth.uid()
    )
  );

-- 3) baby_diary policies
DROP POLICY IF EXISTS "Users can view their own diary entries" ON public.baby_diary;
DROP POLICY IF EXISTS "Users can insert their own diary entries" ON public.baby_diary;
DROP POLICY IF EXISTS "Users can update their own diary entries" ON public.baby_diary;
DROP POLICY IF EXISTS "Users can delete their own diary entries" ON public.baby_diary;

CREATE POLICY "Baby diary: select by member" ON public.baby_diary
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby diary: insert by member" ON public.baby_diary
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Baby diary: update by member" ON public.baby_diary
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby diary: delete by member" ON public.baby_diary
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

-- 4) baby_daily policies
DROP POLICY IF EXISTS "Users can view their own daily entries" ON public.baby_daily;
DROP POLICY IF EXISTS "Users can insert their own daily entries" ON public.baby_daily;
DROP POLICY IF EXISTS "Users can update their own daily entries" ON public.baby_daily;
DROP POLICY IF EXISTS "Users can delete their own daily entries" ON public.baby_daily;
DROP POLICY IF EXISTS "Users can view their own and linked users daily entries" ON public.baby_daily;

CREATE POLICY "Baby daily: select by member" ON public.baby_daily
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby daily: insert by member" ON public.baby_daily
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Baby daily: update by member" ON public.baby_daily
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby daily: delete by member" ON public.baby_daily
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

-- 5) baby_care_entries policies
DROP POLICY IF EXISTS "Users can view their own baby care entries" ON public.baby_care_entries;
DROP POLICY IF EXISTS "Users can insert their own baby care entries" ON public.baby_care_entries;
DROP POLICY IF EXISTS "Users can update their own baby care entries" ON public.baby_care_entries;
DROP POLICY IF EXISTS "Users can delete their own baby care entries" ON public.baby_care_entries;

CREATE POLICY "Baby care: select by member" ON public.baby_care_entries
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby care: insert by member" ON public.baby_care_entries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Baby care: update by member" ON public.baby_care_entries
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Baby care: delete by member" ON public.baby_care_entries
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

-- 6) baby_milestone_progress policies
DROP POLICY IF EXISTS "Users can view their own milestone progress" ON public.baby_milestone_progress;
DROP POLICY IF EXISTS "Users can insert their own milestone progress" ON public.baby_milestone_progress;
DROP POLICY IF EXISTS "Users can update their own milestone progress" ON public.baby_milestone_progress;
DROP POLICY IF EXISTS "Users can delete their own milestone progress" ON public.baby_milestone_progress;

CREATE POLICY "Milestone progress: select by member" ON public.baby_milestone_progress
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Milestone progress: insert by member" ON public.baby_milestone_progress
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Milestone progress: update by member" ON public.baby_milestone_progress
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Milestone progress: delete by member" ON public.baby_milestone_progress
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

-- 7) baby_current_phase policies
DROP POLICY IF EXISTS "Users can view their own current phase" ON public.baby_current_phase;
DROP POLICY IF EXISTS "Users can insert their own current phase" ON public.baby_current_phase;
DROP POLICY IF EXISTS "Users can update their own current phase" ON public.baby_current_phase;
DROP POLICY IF EXISTS "Users can delete their own current phase" ON public.baby_current_phase;

CREATE POLICY "Current phase: select by member" ON public.baby_current_phase
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Current phase: insert by member" ON public.baby_current_phase
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Current phase: update by member" ON public.baby_current_phase
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Current phase: delete by member" ON public.baby_current_phase
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

-- 8) sleep_entries policies
ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sleep entries: select by member" ON public.sleep_entries;
DROP POLICY IF EXISTS "Sleep entries: insert by member" ON public.sleep_entries;
DROP POLICY IF EXISTS "Sleep entries: update by member" ON public.sleep_entries;
DROP POLICY IF EXISTS "Sleep entries: delete by member" ON public.sleep_entries;

CREATE POLICY "Sleep entries: select by member" ON public.sleep_entries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = partner_id
    OR auth.uid() = shared_with_user_id
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Sleep entries: insert by member" ON public.sleep_entries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      baby_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.baby_members bm
        WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.baby_info bi
        WHERE bi.id = baby_id AND bi.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Sleep entries: update by member" ON public.sleep_entries
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Sleep entries: delete by member" ON public.sleep_entries
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = baby_id AND bm.user_id = auth.uid()
    )
  );

-- 9) Daily entries RPCs (multi-baby aware)
CREATE OR REPLACE FUNCTION public.get_daily_entries_with_sync_info(
  p_user_id UUID,
  p_date TIMESTAMPTZ DEFAULT NULL,
  p_baby_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entries jsonb;
  v_members jsonb := '[]'::jsonb;
  v_baby_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_baby_id := p_baby_id;

  IF v_baby_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.baby_members bm
      WHERE bm.baby_id = v_baby_id AND bm.user_id = p_user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.baby_info bi
      WHERE bi.id = v_baby_id AND bi.user_id = p_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'No access to baby');
    END IF;
  END IF;

  IF p_date IS NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', bd.id,
          'baby_id', bd.baby_id,
          'entry_date', bd.entry_date,
          'entry_type', bd.entry_type,
          'start_time', bd.start_time,
          'end_time', bd.end_time,
          'notes', bd.notes
        ) ORDER BY bd.entry_date DESC, bd.start_time DESC
      ),
      '[]'::jsonb
    ) INTO v_entries
    FROM public.baby_daily bd
    WHERE (v_baby_id IS NULL OR bd.baby_id = v_baby_id)
      AND (
        bd.user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.baby_members bm
          WHERE bm.baby_id = bd.baby_id AND bm.user_id = p_user_id
        )
      );
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', bd.id,
          'baby_id', bd.baby_id,
          'entry_date', bd.entry_date,
          'entry_type', bd.entry_type,
          'start_time', bd.start_time,
          'end_time', bd.end_time,
          'notes', bd.notes
        ) ORDER BY bd.entry_date DESC, bd.start_time DESC
      ),
      '[]'::jsonb
    ) INTO v_entries
    FROM public.baby_daily bd
    WHERE (v_baby_id IS NULL OR bd.baby_id = v_baby_id)
      AND (
        bd.user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.baby_members bm
          WHERE bm.baby_id = bd.baby_id AND bm.user_id = p_user_id
        )
      )
      AND bd.entry_date >= date_trunc('day', p_date)
      AND bd.entry_date < date_trunc('day', p_date) + interval '1 day';
  END IF;

  IF v_baby_id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'userId', p.id,
          'firstName', p.first_name,
          'lastName', p.last_name,
          'userRole', p.user_role,
          'role', bm.role
        ) ORDER BY p.first_name
      ),
      '[]'::jsonb
    ) INTO v_members
    FROM public.baby_members bm
    JOIN public.profiles p ON p.id = bm.user_id
    WHERE bm.baby_id = v_baby_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entries', v_entries,
    'linkedUsers', v_members
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_daily_entry_and_sync(
  p_user_id UUID,
  p_entry_date TIMESTAMPTZ,
  p_entry_type TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_baby_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_id UUID;
  v_baby_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_baby_id := p_baby_id;
  IF v_baby_id IS NULL THEN
    SELECT id INTO v_baby_id
    FROM public.baby_info
    WHERE user_id = p_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_baby_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No baby found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.baby_members bm
    WHERE bm.baby_id = v_baby_id AND bm.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.baby_info bi
    WHERE bi.id = v_baby_id AND bi.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No access to baby');
  END IF;

  INSERT INTO public.baby_daily (
    user_id,
    baby_id,
    entry_date,
    entry_type,
    start_time,
    end_time,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_baby_id,
    p_entry_date,
    p_entry_type,
    p_start_time,
    p_end_time,
    p_notes,
    NOW(),
    NOW()
  ) RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'entryId', v_entry_id,
    'synced', false,
    'syncedCount', 0,
    'linkedUsers', '[]'::jsonb,
    'babyId', v_baby_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_daily_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID,
  p_entry_date TIMESTAMPTZ,
  p_entry_type TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_baby_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry RECORD;
  v_baby_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_entry
  FROM public.baby_daily
  WHERE id = p_entry_id
  LIMIT 1;

  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Eintrag nicht gefunden');
  END IF;

  v_baby_id := COALESCE(p_baby_id, v_entry.baby_id);

  IF p_baby_id IS NOT NULL AND v_entry.baby_id <> p_baby_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry does not match baby');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.baby_members bm
    WHERE bm.baby_id = v_entry.baby_id AND bm.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.baby_info bi
    WHERE bi.id = v_entry.baby_id AND bi.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No access to baby');
  END IF;

  UPDATE public.baby_daily
  SET
    entry_date = p_entry_date,
    entry_type = p_entry_type,
    start_time = p_start_time,
    end_time = p_end_time,
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'synced', false,
    'syncedCount', 0,
    'linkedUsers', '[]'::jsonb,
    'babyId', v_baby_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_daily_entry_and_sync(
  p_user_id UUID,
  p_entry_id UUID,
  p_baby_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry RECORD;
  v_baby_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_entry
  FROM public.baby_daily
  WHERE id = p_entry_id
  LIMIT 1;

  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Eintrag nicht gefunden');
  END IF;

  v_baby_id := COALESCE(p_baby_id, v_entry.baby_id);

  IF p_baby_id IS NOT NULL AND v_entry.baby_id <> p_baby_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry does not match baby');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.baby_members bm
    WHERE bm.baby_id = v_entry.baby_id AND bm.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.baby_info bi
    WHERE bi.id = v_entry.baby_id AND bi.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No access to baby');
  END IF;

  DELETE FROM public.baby_daily
  WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'deletedCount', 1,
    'synced', false,
    'syncedCount', 0,
    'linkedUsers', '[]'::jsonb,
    'babyId', v_baby_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_all_existing_daily_entries(
  p_user_id UUID,
  p_baby_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'No sync required for multi-baby.',
    'syncedCount', 0,
    'linkedUsers', '[]'::jsonb,
    'babyId', p_baby_id
  );
END;
$$;

-- 10) Sleep sharing RPCs
CREATE OR REPLACE FUNCTION public.share_sleep_entry_v2(
  p_entry_id UUID,
  p_partner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_baby_id UUID;
  v_result JSONB;
BEGIN
  SELECT user_id, baby_id INTO v_owner_id, v_baby_id
  FROM public.sleep_entries
  WHERE id = p_entry_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Eintrag nicht gefunden'
    );
  END IF;

  IF v_owner_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Keine Berechtigung zum Teilen dieses Eintrags'
    );
  END IF;

  IF auth.uid() = p_partner_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Eintrag kann nicht mit dir selbst geteilt werden'
    );
  END IF;

  IF v_baby_id IS NOT NULL THEN
    INSERT INTO public.baby_members (baby_id, user_id, role)
    VALUES (v_baby_id, p_partner_id, 'partner')
    ON CONFLICT DO NOTHING;
  END IF;

  BEGIN
    INSERT INTO public.sleep_entry_shares (entry_id, owner_id, shared_with_id)
    VALUES (p_entry_id, auth.uid(), p_partner_id);

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

CREATE OR REPLACE FUNCTION public.get_all_visible_sleep_entries(
  p_baby_id UUID DEFAULT NULL
)
RETURNS SETOF public.sleep_entries
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT se.*
  FROM public.sleep_entries se
  LEFT JOIN public.sleep_entry_shares ses
    ON ses.entry_id = se.id
    AND ses.shared_with_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND (p_baby_id IS NULL OR se.baby_id = p_baby_id)
    AND (
      se.user_id = auth.uid()
      OR se.partner_id = auth.uid()
      OR se.shared_with_user_id = auth.uid()
      OR ses.shared_with_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.baby_members bm
        WHERE bm.baby_id = se.baby_id AND bm.user_id = auth.uid()
      )
    )
  ORDER BY se.start_time DESC;
$$;

-- Grants (keep existing in case they were removed)
GRANT EXECUTE ON FUNCTION public.share_sleep_entry_v2(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unshare_sleep_entry_v2(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_visible_sleep_entries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_entries_with_sync_info(UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_daily_entry_and_sync(UUID, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_daily_entry_and_sync(UUID, UUID, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_daily_entry_and_sync(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_existing_daily_entries(UUID, UUID) TO authenticated;

-- Done
