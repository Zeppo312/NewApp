-- Preserve existing event reminder behaviour for legacy rows and allow NULL to
-- mean "no reminder" for future writes.

UPDATE public.planner_items
SET reminder_minutes = 15
WHERE entry_type = 'event'
  AND start_at IS NOT NULL
  AND reminder_minutes IS NULL;

CREATE OR REPLACE FUNCTION create_planner_notifications()
RETURNS TRIGGER AS $$
DECLARE
  event_start TIMESTAMPTZ;
  todo_due TIMESTAMPTZ;
  reminder_time TIMESTAMPTZ;
  effective_reminder_minutes INTEGER;
BEGIN
  -- Only recreate notifications when relevant scheduling fields changed
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.start_at IS NOT DISTINCT FROM OLD.start_at) AND
       (NEW.due_at IS NOT DISTINCT FROM OLD.due_at) AND
       (NEW.entry_type IS NOT DISTINCT FROM OLD.entry_type) AND
       (NEW.reminder_minutes IS NOT DISTINCT FROM OLD.reminder_minutes) THEN
      RETURN NEW;
    END IF;

    DELETE FROM public.planner_notifications
    WHERE planner_item_id = NEW.id;
  END IF;

  IF NEW.entry_type = 'event'
     AND NEW.start_at IS NOT NULL
     AND NEW.reminder_minutes IS NOT NULL THEN
    event_start := NEW.start_at;
    effective_reminder_minutes := GREATEST(0, LEAST(10080, NEW.reminder_minutes));
    reminder_time := event_start - (effective_reminder_minutes || ' minutes')::INTERVAL;

    IF reminder_time > now() THEN
      INSERT INTO public.planner_notifications (
        user_id,
        planner_item_id,
        notification_type,
        scheduled_for,
        reminder_minutes
      ) VALUES (
        NEW.user_id,
        NEW.id,
        'event_reminder',
        reminder_time,
        effective_reminder_minutes
      );
    END IF;
  END IF;

  IF NEW.entry_type = 'todo' AND NEW.due_at IS NOT NULL THEN
    todo_due := NEW.due_at;

    IF todo_due > now() THEN
      INSERT INTO public.planner_notifications (
        user_id,
        planner_item_id,
        notification_type,
        scheduled_for,
        reminder_minutes
      ) VALUES (
        NEW.user_id,
        NEW.id,
        'todo_due',
        todo_due,
        0
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_planner_notifications IS 'Automatically creates notifications when planner items are created/updated';
