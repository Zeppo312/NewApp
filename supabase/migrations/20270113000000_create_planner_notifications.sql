-- Create planner notifications table for scheduled reminders
-- This enables reminders for planner events and todos

-- Create the planner_notifications table
CREATE TABLE IF NOT EXISTS public.planner_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planner_item_id UUID NOT NULL REFERENCES public.planner_items(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('event_reminder', 'todo_due', 'todo_overdue')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  reminder_minutes INTEGER, -- How many minutes before the event/todo to remind (e.g., 15, 30, 60)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_planner_notifications_user_id ON public.planner_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_notifications_scheduled_for ON public.planner_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_planner_notifications_sent ON public.planner_notifications(sent) WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_planner_notifications_planner_item_id ON public.planner_notifications(planner_item_id);

-- Enable RLS
ALTER TABLE public.planner_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own notifications
CREATE POLICY "Users can view their own planner notifications"
  ON public.planner_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own planner notifications"
  ON public.planner_notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own planner notifications"
  ON public.planner_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planner notifications"
  ON public.planner_notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically create notifications when planner items are created/updated
CREATE OR REPLACE FUNCTION create_planner_notifications()
RETURNS TRIGGER AS $$
DECLARE
  event_start TIMESTAMPTZ;
  todo_due TIMESTAMPTZ;
  reminder_time TIMESTAMPTZ;
  default_reminder_minutes INTEGER := 15; -- Default: 15 minutes before
BEGIN
  -- Only create notifications for new items or when relevant fields change
  IF TG_OP = 'UPDATE' THEN
    -- Skip if the relevant fields haven't changed
    IF (NEW.start_at IS NOT DISTINCT FROM OLD.start_at) AND
       (NEW.due_at IS NOT DISTINCT FROM OLD.due_at) AND
       (NEW.entry_type IS NOT DISTINCT FROM OLD.entry_type) THEN
      RETURN NEW;
    END IF;

    -- Delete old notifications for this item
    DELETE FROM public.planner_notifications WHERE planner_item_id = NEW.id;
  END IF;

  -- Handle EVENT notifications
  IF NEW.entry_type = 'event' AND NEW.start_at IS NOT NULL THEN
    event_start := NEW.start_at;
    reminder_time := event_start - (default_reminder_minutes || ' minutes')::INTERVAL;

    -- Only create notification if it's in the future
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
        default_reminder_minutes
      );
    END IF;
  END IF;

  -- Handle TODO notifications
  IF NEW.entry_type = 'todo' AND NEW.due_at IS NOT NULL THEN
    todo_due := NEW.due_at;

    -- Only create notification if it's in the future
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
        0 -- No advance reminder for todos by default
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic notification creation
DROP TRIGGER IF EXISTS trigger_create_planner_notifications ON public.planner_items;
CREATE TRIGGER trigger_create_planner_notifications
  AFTER INSERT OR UPDATE ON public.planner_items
  FOR EACH ROW
  EXECUTE FUNCTION create_planner_notifications();

-- Function to clean up notifications when planner items are deleted
-- (CASCADE should handle this, but this is a backup)
CREATE OR REPLACE FUNCTION cleanup_planner_notifications()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.planner_notifications WHERE planner_item_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cleanup_planner_notifications ON public.planner_items;
CREATE TRIGGER trigger_cleanup_planner_notifications
  BEFORE DELETE ON public.planner_items
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_planner_notifications();

-- Add comments for documentation
COMMENT ON TABLE public.planner_notifications IS 'Stores scheduled notifications for planner events and todos';
COMMENT ON COLUMN public.planner_notifications.notification_type IS 'Type of notification: event_reminder, todo_due, or todo_overdue';
COMMENT ON COLUMN public.planner_notifications.scheduled_for IS 'When the notification should be sent';
COMMENT ON COLUMN public.planner_notifications.reminder_minutes IS 'How many minutes before the event/todo to send reminder';
COMMENT ON FUNCTION create_planner_notifications IS 'Automatically creates notifications when planner items are created/updated';
COMMENT ON FUNCTION cleanup_planner_notifications IS 'Cleans up notifications when planner items are deleted';
