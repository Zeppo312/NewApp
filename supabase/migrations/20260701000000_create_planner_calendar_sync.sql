CREATE TABLE IF NOT EXISTS public.planner_calendar_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_install_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  apple_calendar_id TEXT,
  apple_calendar_title TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_past_days INTEGER NOT NULL DEFAULT 30,
  sync_future_days INTEGER NOT NULL DEFAULT 365,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_calendar_sync_settings_unique UNIQUE (user_id, device_install_id),
  CONSTRAINT planner_calendar_sync_settings_window_check CHECK (
    sync_past_days BETWEEN 0 AND 3660
    AND sync_future_days BETWEEN 1 AND 3660
  )
);

CREATE TABLE IF NOT EXISTS public.planner_calendar_sync_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_install_id TEXT NOT NULL,
  sync_kind TEXT NOT NULL CHECK (sync_kind IN ('single', 'series', 'occurrence')),
  planner_item_id UUID REFERENCES public.planner_items(id) ON DELETE SET NULL,
  planner_recurring_item_id UUID REFERENCES public.planner_recurring_items(id) ON DELETE SET NULL,
  planner_recurring_exception_id UUID REFERENCES public.planner_recurring_exceptions(id) ON DELETE SET NULL,
  occurrence_date DATE,
  apple_calendar_id TEXT NOT NULL,
  apple_event_id TEXT NOT NULL,
  apple_original_event_id TEXT,
  last_planner_updated_at TIMESTAMPTZ,
  last_apple_modified_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_calendar_sync_links_single_shape CHECK (
    sync_kind <> 'single'
    OR (
      planner_recurring_item_id IS NULL
      AND planner_recurring_exception_id IS NULL
      AND occurrence_date IS NULL
    )
  ),
  CONSTRAINT planner_calendar_sync_links_series_shape CHECK (
    sync_kind <> 'series'
    OR (
      planner_item_id IS NULL
      AND planner_recurring_exception_id IS NULL
      AND occurrence_date IS NULL
    )
  ),
  CONSTRAINT planner_calendar_sync_links_occurrence_shape CHECK (
    sync_kind <> 'occurrence'
    OR (
      planner_item_id IS NULL
      AND occurrence_date IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_calendar_sync_settings_user_device
  ON public.planner_calendar_sync_settings(user_id, device_install_id);

CREATE INDEX IF NOT EXISTS idx_planner_calendar_sync_links_user_device
  ON public.planner_calendar_sync_links(user_id, device_install_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_calendar_sync_links_single
  ON public.planner_calendar_sync_links(user_id, device_install_id, planner_item_id)
  WHERE sync_kind = 'single' AND planner_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_calendar_sync_links_series
  ON public.planner_calendar_sync_links(user_id, device_install_id, planner_recurring_item_id)
  WHERE sync_kind = 'series' AND planner_recurring_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_calendar_sync_links_occurrence
  ON public.planner_calendar_sync_links(user_id, device_install_id, planner_recurring_item_id, occurrence_date)
  WHERE sync_kind = 'occurrence' AND planner_recurring_item_id IS NOT NULL AND occurrence_date IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_planner_calendar_sync_links_apple_event
  ON public.planner_calendar_sync_links(user_id, device_install_id, apple_calendar_id, apple_event_id);

ALTER TABLE public.planner_calendar_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_calendar_sync_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE
  ON public.planner_calendar_sync_settings
  TO authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.planner_calendar_sync_links
  TO authenticated;

DROP POLICY IF EXISTS "planner_calendar_sync_settings_select_own" ON public.planner_calendar_sync_settings;
CREATE POLICY "planner_calendar_sync_settings_select_own"
  ON public.planner_calendar_sync_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "planner_calendar_sync_settings_insert_own" ON public.planner_calendar_sync_settings;
CREATE POLICY "planner_calendar_sync_settings_insert_own"
  ON public.planner_calendar_sync_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "planner_calendar_sync_settings_update_own" ON public.planner_calendar_sync_settings;
CREATE POLICY "planner_calendar_sync_settings_update_own"
  ON public.planner_calendar_sync_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "planner_calendar_sync_links_select_own" ON public.planner_calendar_sync_links;
CREATE POLICY "planner_calendar_sync_links_select_own"
  ON public.planner_calendar_sync_links
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "planner_calendar_sync_links_insert_own" ON public.planner_calendar_sync_links;
CREATE POLICY "planner_calendar_sync_links_insert_own"
  ON public.planner_calendar_sync_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "planner_calendar_sync_links_update_own" ON public.planner_calendar_sync_links;
CREATE POLICY "planner_calendar_sync_links_update_own"
  ON public.planner_calendar_sync_links
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_planner_calendar_sync_settings_updated_at
  ON public.planner_calendar_sync_settings;
CREATE TRIGGER trg_planner_calendar_sync_settings_updated_at
BEFORE UPDATE ON public.planner_calendar_sync_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_planner_calendar_sync_links_updated_at
  ON public.planner_calendar_sync_links;
CREATE TRIGGER trg_planner_calendar_sync_links_updated_at
BEFORE UPDATE ON public.planner_calendar_sync_links
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.planner_calendar_sync_settings IS 'Per-user, per-device settings for native Apple Calendar sync';
COMMENT ON TABLE public.planner_calendar_sync_links IS 'Per-device mapping between Planner rows and local native calendar event IDs';
