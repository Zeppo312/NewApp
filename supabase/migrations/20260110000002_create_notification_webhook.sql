-- Create a webhook that triggers the Edge Function when a new partner notification is created
-- This enables real-time push notifications even when the app is closed

-- First, we need to enable the pg_net extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function that will be called by the trigger to send the webhook
CREATE OR REPLACE FUNCTION send_partner_notification_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  request_id BIGINT;
BEGIN
  -- Use the external Supabase URL for the webhook
  -- This works from the database's perspective
  webhook_url := 'https://kwniiyayhzgjfqjsjcfu.supabase.co/functions/v1/send-partner-notification';

  -- Make async HTTP POST request to the Edge Function
  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'partner_activity_notifications',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'partner_id', NEW.partner_id,
        'activity_type', NEW.activity_type,
        'activity_subtype', NEW.activity_subtype,
        'entry_id', NEW.entry_id,
        'created_at', NEW.created_at
      )
    )
  ) INTO request_id;

  RAISE NOTICE 'Webhook sent with request_id: %', request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block the insert
    RAISE WARNING 'Failed to send webhook: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that calls the webhook function
DROP TRIGGER IF EXISTS trigger_send_partner_notification_webhook ON partner_activity_notifications;
CREATE TRIGGER trigger_send_partner_notification_webhook
  AFTER INSERT ON partner_activity_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_partner_notification_webhook();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

COMMENT ON FUNCTION send_partner_notification_webhook IS 'Sends webhook to Edge Function for real-time push notifications';
COMMENT ON TRIGGER trigger_send_partner_notification_webhook ON partner_activity_notifications IS 'Triggers push notification when new partner activity is created';
