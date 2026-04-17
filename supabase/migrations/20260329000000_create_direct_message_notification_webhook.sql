-- Send real push notifications for direct messages without depending on
-- community_notifications inserts. This avoids duplicate notifications for
-- older app versions that may still write `type = 'message'` manually.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.send_direct_message_notification_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_base_url text;
  webhook_url text;
  webhook_secret text;
  request_id bigint;
BEGIN
  supabase_base_url := nullif(current_setting('app.settings.supabase_url', true), '');
  webhook_secret := nullif(current_setting('app.settings.direct_message_webhook_secret', true), '');

  IF supabase_base_url IS NULL THEN
    supabase_base_url := 'https://kwniiyayhzgjfqjsjcfu.supabase.co';
  END IF;

  IF webhook_secret IS NULL THEN
    RAISE WARNING 'Direct message webhook secret missing; skipping push webhook';
    RETURN NEW;
  END IF;

  webhook_url := supabase_base_url || '/functions/v1/send-direct-message-notification';

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'direct_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'sender_id', NEW.sender_id,
        'receiver_id', NEW.receiver_id,
        'content', NEW.content,
        'created_at', NEW.created_at,
        'is_read', NEW.is_read
      )
    )
  ) INTO request_id;

  RAISE NOTICE 'Direct message webhook sent with request_id: %', request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send direct message webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_direct_message_notification_webhook ON public.direct_messages;

CREATE TRIGGER trigger_send_direct_message_notification_webhook
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  WHEN (NEW.is_read IS NOT TRUE)
  EXECUTE FUNCTION public.send_direct_message_notification_webhook();

REVOKE USAGE ON SCHEMA net FROM anon, authenticated;
GRANT USAGE ON SCHEMA net TO postgres, service_role;

COMMENT ON FUNCTION public.send_direct_message_notification_webhook IS
  'Sends webhook to Edge Function for direct message push notifications';

COMMENT ON TRIGGER trigger_send_direct_message_notification_webhook ON public.direct_messages IS
  'Triggers push notification webhook when a new direct message is created';
