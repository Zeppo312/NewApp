-- Eigene Farbe pro Planer-Eintrag (Termine/Aufgaben).
-- NULL bedeutet: Farbe wird weiterhin aus der zugeordneten Person abgeleitet.

ALTER TABLE public.planner_items
  ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE public.planner_recurring_items
  ADD COLUMN IF NOT EXISTS color TEXT;

ALTER TABLE public.planner_recurring_exceptions
  ADD COLUMN IF NOT EXISTS color TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planner_items_color_check'
  ) THEN
    ALTER TABLE public.planner_items
      ADD CONSTRAINT planner_items_color_check
      CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planner_recurring_items_color_check'
  ) THEN
    ALTER TABLE public.planner_recurring_items
      ADD CONSTRAINT planner_recurring_items_color_check
      CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planner_recurring_exceptions_color_check'
  ) THEN
    ALTER TABLE public.planner_recurring_exceptions
      ADD CONSTRAINT planner_recurring_exceptions_color_check
      CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END;
$$;
