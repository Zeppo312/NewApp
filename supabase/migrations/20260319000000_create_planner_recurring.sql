CREATE TABLE IF NOT EXISTS public.planner_recurring_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('todo', 'event')),
  title TEXT NOT NULL,
  notes TEXT,
  location TEXT,
  assignee TEXT CHECK (assignee IN ('me', 'partner', 'family', 'child')),
  baby_id UUID REFERENCES public.baby_info(id) ON DELETE SET NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  due_at_minutes INTEGER,
  start_at_minutes INTEGER,
  end_at_minutes INTEGER,
  repeat_days SMALLINT[] NOT NULL DEFAULT '{}',
  starts_on DATE NOT NULL,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planner_recurring_repeat_days_check CHECK (
    cardinality(repeat_days) > 0
    AND repeat_days <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]
  ),
  CONSTRAINT planner_recurring_due_minutes_check CHECK (
    due_at_minutes IS NULL OR due_at_minutes BETWEEN 0 AND 1439
  ),
  CONSTRAINT planner_recurring_start_minutes_check CHECK (
    start_at_minutes IS NULL OR start_at_minutes BETWEEN 0 AND 1439
  ),
  CONSTRAINT planner_recurring_end_minutes_check CHECK (
    end_at_minutes IS NULL OR end_at_minutes BETWEEN 0 AND 1439
  ),
  CONSTRAINT planner_recurring_date_order_check CHECK (
    ends_on IS NULL OR ends_on >= starts_on
  ),
  CONSTRAINT planner_recurring_todo_shape_check CHECK (
    entry_type <> 'todo'
    OR (
      due_at_minutes IS NOT NULL
      AND start_at_minutes IS NULL
      AND end_at_minutes IS NULL
      AND location IS NULL
      AND is_all_day = FALSE
    )
  ),
  CONSTRAINT planner_recurring_event_shape_check CHECK (
    entry_type <> 'event'
    OR (
      due_at_minutes IS NULL
      AND start_at_minutes IS NOT NULL
      AND (
        is_all_day = TRUE
        OR (
          end_at_minutes IS NOT NULL
          AND end_at_minutes > start_at_minutes
        )
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_recurring_items_user
  ON public.planner_recurring_items(user_id);

CREATE INDEX IF NOT EXISTS idx_recurring_items_user_dates
  ON public.planner_recurring_items(user_id, starts_on, ends_on);

ALTER TABLE public.planner_recurring_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planner_recurring_items_select_own" ON public.planner_recurring_items;
CREATE POLICY "planner_recurring_items_select_own" ON public.planner_recurring_items
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

DROP POLICY IF EXISTS "planner_recurring_items_insert_own" ON public.planner_recurring_items;
CREATE POLICY "planner_recurring_items_insert_own" ON public.planner_recurring_items
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

DROP POLICY IF EXISTS "planner_recurring_items_update_own" ON public.planner_recurring_items;
CREATE POLICY "planner_recurring_items_update_own" ON public.planner_recurring_items
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

DROP POLICY IF EXISTS "planner_recurring_items_delete_own" ON public.planner_recurring_items;
CREATE POLICY "planner_recurring_items_delete_own" ON public.planner_recurring_items
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

DROP TRIGGER IF EXISTS trg_planner_recurring_items_updated_at ON public.planner_recurring_items;
CREATE TRIGGER trg_planner_recurring_items_updated_at
BEFORE UPDATE ON public.planner_recurring_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.planner_recurring_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_item_id UUID NOT NULL REFERENCES public.planner_recurring_items(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT,
  notes TEXT,
  location TEXT,
  assignee TEXT CHECK (assignee IS NULL OR assignee IN ('me', 'partner', 'family', 'child')),
  baby_id UUID REFERENCES public.baby_info(id) ON DELETE SET NULL,
  is_all_day BOOLEAN,
  due_at_minutes INTEGER,
  start_at_minutes INTEGER,
  end_at_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recurring_exceptions_unique UNIQUE (recurring_item_id, day),
  CONSTRAINT recurring_exceptions_due_minutes_check CHECK (
    due_at_minutes IS NULL OR due_at_minutes BETWEEN 0 AND 1439
  ),
  CONSTRAINT recurring_exceptions_start_minutes_check CHECK (
    start_at_minutes IS NULL OR start_at_minutes BETWEEN 0 AND 1439
  ),
  CONSTRAINT recurring_exceptions_end_minutes_check CHECK (
    end_at_minutes IS NULL OR end_at_minutes BETWEEN 0 AND 1439
  ),
  CONSTRAINT recurring_exceptions_same_day_event_check CHECK (
    start_at_minutes IS NULL
    OR end_at_minutes IS NULL
    OR end_at_minutes > start_at_minutes
  ),
  CONSTRAINT recurring_exceptions_deleted_completed_check CHECK (
    NOT (deleted AND completed)
  )
);

CREATE INDEX IF NOT EXISTS idx_recurring_exc_item_day
  ON public.planner_recurring_exceptions(recurring_item_id, day);

CREATE INDEX IF NOT EXISTS idx_recurring_exc_user_day
  ON public.planner_recurring_exceptions(user_id, day);

ALTER TABLE public.planner_recurring_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planner_recurring_exceptions_select_own" ON public.planner_recurring_exceptions;
CREATE POLICY "planner_recurring_exceptions_select_own" ON public.planner_recurring_exceptions
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

DROP POLICY IF EXISTS "planner_recurring_exceptions_insert_own" ON public.planner_recurring_exceptions;
CREATE POLICY "planner_recurring_exceptions_insert_own" ON public.planner_recurring_exceptions
  FOR INSERT WITH CHECK (
    (
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
    AND EXISTS (
      SELECT 1
      FROM public.planner_recurring_items pri
      WHERE pri.id = recurring_item_id
        AND pri.user_id = user_id
    )
  );

DROP POLICY IF EXISTS "planner_recurring_exceptions_update_own" ON public.planner_recurring_exceptions;
CREATE POLICY "planner_recurring_exceptions_update_own" ON public.planner_recurring_exceptions
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
    (
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
    AND EXISTS (
      SELECT 1
      FROM public.planner_recurring_items pri
      WHERE pri.id = recurring_item_id
        AND pri.user_id = user_id
    )
  );

DROP POLICY IF EXISTS "planner_recurring_exceptions_delete_own" ON public.planner_recurring_exceptions;
CREATE POLICY "planner_recurring_exceptions_delete_own" ON public.planner_recurring_exceptions
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

DROP TRIGGER IF EXISTS trg_planner_recurring_exceptions_updated_at ON public.planner_recurring_exceptions;
CREATE TRIGGER trg_planner_recurring_exceptions_updated_at
BEFORE UPDATE ON public.planner_recurring_exceptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
