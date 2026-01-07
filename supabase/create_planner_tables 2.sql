-- Tabellen und Policies für den Planner-Bereich

-- Sicherstellen, dass benötigte Erweiterungen verfügbar sind
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum-Typ für Stimmung anlegen (falls noch nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'planner_mood'
  ) THEN
    CREATE TYPE public.planner_mood AS ENUM ('great', 'good', 'okay', 'bad');
  END IF;
END;
$$;

-- Trigger-Funktion zum Aktualisieren von updated_at (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabelle für Tageszusammenfassungen
CREATE TABLE IF NOT EXISTS public.planner_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  tasks_total INTEGER NOT NULL DEFAULT 0,
  tasks_done INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  baby_sleep_hours NUMERIC(4,2),
  mood public.planner_mood,
  reflection TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_days_unique_user_day UNIQUE (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_planner_days_user_day ON public.planner_days(user_id, day);

ALTER TABLE public.planner_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planner_days_select_own" ON public.planner_days;
CREATE POLICY "planner_days_select_own" ON public.planner_days
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP POLICY IF EXISTS "planner_days_insert_own" ON public.planner_days;
CREATE POLICY "planner_days_insert_own" ON public.planner_days
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP POLICY IF EXISTS "planner_days_update_own" ON public.planner_days;
CREATE POLICY "planner_days_update_own" ON public.planner_days
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP POLICY IF EXISTS "planner_days_delete_own" ON public.planner_days;
CREATE POLICY "planner_days_delete_own" ON public.planner_days
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP TRIGGER IF EXISTS trg_planner_days_updated_at ON public.planner_days;
CREATE TRIGGER trg_planner_days_updated_at
BEFORE UPDATE ON public.planner_days
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 2. Tabelle für Zeitblöcke innerhalb eines Tages
CREATE TABLE IF NOT EXISTS public.planner_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES public.planner_days(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_blocks_time_check CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_planner_blocks_day ON public.planner_blocks(day_id);
CREATE INDEX IF NOT EXISTS idx_planner_blocks_user ON public.planner_blocks(user_id);

ALTER TABLE public.planner_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planner_blocks_select_own" ON public.planner_blocks;
CREATE POLICY "planner_blocks_select_own" ON public.planner_blocks
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP POLICY IF EXISTS "planner_blocks_insert_own" ON public.planner_blocks;
CREATE POLICY "planner_blocks_insert_own" ON public.planner_blocks
  FOR INSERT WITH CHECK (
    (auth.uid() = user_id OR
      EXISTS (
        SELECT 1
        FROM public.account_links al
        WHERE al.status = 'accepted'
          AND (
            (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
            (al.invited_id = auth.uid() AND al.creator_id = user_id)
          )
      )
    ) AND
    EXISTS (
      SELECT 1
      FROM public.planner_days d
      WHERE d.id = day_id AND d.user_id = user_id
    )
  );

DROP POLICY IF EXISTS "planner_blocks_update_own" ON public.planner_blocks;
CREATE POLICY "planner_blocks_update_own" ON public.planner_blocks
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  )
  WITH CHECK (
    (auth.uid() = user_id OR
      EXISTS (
        SELECT 1
        FROM public.account_links al
        WHERE al.status = 'accepted'
          AND (
            (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
            (al.invited_id = auth.uid() AND al.creator_id = user_id)
          )
      )
    ) AND
    EXISTS (
      SELECT 1
      FROM public.planner_days d
      WHERE d.id = day_id AND d.user_id = user_id
    )
  );

DROP POLICY IF EXISTS "planner_blocks_delete_own" ON public.planner_blocks;
CREATE POLICY "planner_blocks_delete_own" ON public.planner_blocks
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP TRIGGER IF EXISTS trg_planner_blocks_updated_at ON public.planner_blocks;
CREATE TRIGGER trg_planner_blocks_updated_at
BEFORE UPDATE ON public.planner_blocks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 3. Tabelle für Todos, Termine und Notizen
CREATE TABLE IF NOT EXISTS public.planner_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES public.planner_days(id) ON DELETE CASCADE,
  block_id UUID REFERENCES public.planner_blocks(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('todo', 'event', 'note')),
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  assignee TEXT CHECK (assignee IN ('me', 'partner', 'family', 'child')),
  notes TEXT,
  location TEXT,
  due_at TIMESTAMPTZ,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_items_event_times CHECK (
    entry_type <> 'event'
    OR (
      start_at IS NOT NULL
      AND end_at IS NOT NULL
      AND start_at < end_at
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_planner_items_user ON public.planner_items(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_items_day ON public.planner_items(day_id);
CREATE INDEX IF NOT EXISTS idx_planner_items_type ON public.planner_items(entry_type);

ALTER TABLE public.planner_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planner_items_select_own" ON public.planner_items;
CREATE POLICY "planner_items_select_own" ON public.planner_items
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP POLICY IF EXISTS "planner_items_insert_own" ON public.planner_items;
CREATE POLICY "planner_items_insert_own" ON public.planner_items
  FOR INSERT WITH CHECK (
    (auth.uid() = user_id OR
      EXISTS (
        SELECT 1
        FROM public.account_links al
        WHERE al.status = 'accepted'
          AND (
            (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
            (al.invited_id = auth.uid() AND al.creator_id = user_id)
          )
      )
    ) AND
    EXISTS (
      SELECT 1
      FROM public.planner_days d
      WHERE d.id = day_id AND d.user_id = user_id
    ) AND
    (
      block_id IS NULL OR
      EXISTS (
        SELECT 1
        FROM public.planner_blocks b
        WHERE b.id = block_id AND b.user_id = user_id
      )
    )
  );

DROP POLICY IF EXISTS "planner_items_update_own" ON public.planner_items;
CREATE POLICY "planner_items_update_own" ON public.planner_items
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  )
  WITH CHECK (
    (auth.uid() = user_id OR
      EXISTS (
        SELECT 1
        FROM public.account_links al
        WHERE al.status = 'accepted'
          AND (
            (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
            (al.invited_id = auth.uid() AND al.creator_id = user_id)
          )
      )
    ) AND
    EXISTS (
      SELECT 1
      FROM public.planner_days d
      WHERE d.id = day_id AND d.user_id = user_id
    ) AND
    (
      block_id IS NULL OR
      EXISTS (
        SELECT 1
        FROM public.planner_blocks b
        WHERE b.id = block_id AND b.user_id = user_id
      )
    )
  );

DROP POLICY IF EXISTS "planner_items_delete_own" ON public.planner_items;
CREATE POLICY "planner_items_delete_own" ON public.planner_items
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.account_links al
      WHERE al.status = 'accepted'
        AND (
          (al.creator_id = auth.uid() AND al.invited_id = user_id) OR
          (al.invited_id = auth.uid() AND al.creator_id = user_id)
        )
    )
  );

DROP TRIGGER IF EXISTS trg_planner_items_updated_at ON public.planner_items;
CREATE TRIGGER trg_planner_items_updated_at
BEFORE UPDATE ON public.planner_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
