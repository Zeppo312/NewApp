-- Create a webhook that triggers the Edge Function when planner notifications are due
-- This enables real-time push notifications for planner events and todos

-- Create a function that will be called to send planner notification webhook
CREATE OR REPLACE FUNCTION send_planner_notification_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  request_id BIGINT;
  planner_item RECORD;
  baby_name TEXT;
BEGIN
  -- Only process notifications that are scheduled for now or past and not yet sent
  IF NEW.sent = false AND NEW.scheduled_for <= now() THEN

    -- Get the planner item details
    SELECT pi.*, pd.day
    INTO planner_item
    FROM public.planner_items pi
    JOIN public.planner_days pd ON pi.day_id = pd.id
    WHERE pi.id = NEW.planner_item_id;

    -- Get baby name if assigned to a baby
    IF planner_item.baby_id IS NOT NULL THEN
      SELECT name INTO baby_name
      FROM public.baby_info
      WHERE id = planner_item.baby_id;
    END IF;

    -- Use the external Supabase URL for the webhook
    webhook_url := 'https://kwniiyayhzgjfqjsjcfu.supabase.co/functions/v1/send-planner-notification';

    -- Make async HTTP POST request to the Edge Function
    SELECT net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'type', 'planner_notification',
        'notification', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'notification_type', NEW.notification_type,
          'scheduled_for', NEW.scheduled_for,
          'reminder_minutes', NEW.reminder_minutes
        ),
        'planner_item', jsonb_build_object(
          'id', planner_item.id,
          'entry_type', planner_item.entry_type,
          'title', planner_item.title,
          'notes', planner_item.notes,
          'location', planner_item.location,
          'assignee', planner_item.assignee,
          'baby_id', planner_item.baby_id,
          'baby_name', baby_name,
          'start_at', planner_item.start_at,
          'end_at', planner_item.end_at,
          'due_at', planner_item.due_at,
          'day', planner_item.day
        )
      )
    ) INTO request_id;

    -- Mark notification as sent
    UPDATE public.planner_notifications
    SET sent = true, sent_at = now()
    WHERE id = NEW.id;

    RAISE NOTICE 'Planner notification webhook sent with request_id: %', request_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block the process
    RAISE WARNING 'Failed to send planner notification webhook: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that checks for due notifications
-- This will be called when notifications are inserted or updated
DROP TRIGGER IF EXISTS trigger_send_planner_notification_webhook ON public.planner_notifications;
CREATE TRIGGER trigger_send_planner_notification_webhook
  AFTER INSERT OR UPDATE ON public.planner_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_planner_notification_webhook();

-- Create a function to check for due notifications (to be called by pg_cron)
CREATE OR REPLACE FUNCTION check_due_planner_notifications()
RETURNS void AS $$
DECLARE
  notification_record RECORD;
BEGIN
  -- Find all notifications that are due and not yet sent
  FOR notification_record IN
    SELECT *
    FROM public.planner_notifications
    WHERE sent = false
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT 100 -- Process max 100 at a time
  LOOP
    -- Trigger the webhook by updating the record
    -- This will fire the trigger above
    UPDATE public.planner_notifications
    SET updated_at = now()
    WHERE id = notification_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- Add comments for documentation
COMMENT ON FUNCTION send_planner_notification_webhook IS 'Sends webhook to Edge Function for planner push notifications';
COMMENT ON FUNCTION check_due_planner_notifications IS 'Checks for due notifications and triggers webhooks (meant to be called by pg_cron every minute)';
COMMENT ON TRIGGER trigger_send_planner_notification_webhook ON public.planner_notifications IS 'Triggers push notification webhook when planner notification is due';

-- Note: To enable automatic checking, you would need to set up pg_cron:
-- SELECT cron.schedule('check-planner-notifications', '* * * * *', 'SELECT check_due_planner_notifications()');
-- This needs to be done separately as it requires the pg_cron extension
