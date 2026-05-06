-- ============================================================================
-- Webhook trigger for group chat push notifications
-- Fires on every INSERT into community_group_messages and calls the
-- send-group-message-notification Edge Function.
-- Reuses the same webhook secret as the direct message webhook.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_group_message_notification_webhook()
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
    RAISE WARNING 'Group message webhook secret missing; skipping push webhook';
    RETURN NEW;
  END IF;

  webhook_url := supabase_base_url || '/functions/v1/send-group-message-notification';

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'community_group_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'group_id', NEW.group_id,
        'sender_id', NEW.sender_id,
        'content', NEW.content,
        'created_at', NEW.created_at
      )
    )
  ) INTO request_id;

  RAISE NOTICE 'Group message webhook sent with request_id: %', request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send group message webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_group_message_notification_webhook
  ON public.community_group_messages;

CREATE TRIGGER trigger_send_group_message_notification_webhook
  AFTER INSERT ON public.community_group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.send_group_message_notification_webhook();

COMMENT ON FUNCTION public.send_group_message_notification_webhook IS
  'Sends webhook to Edge Function for group message push notifications';

COMMENT ON TRIGGER trigger_send_group_message_notification_webhook ON public.community_group_messages IS
  'Triggers push notification webhook when a new group message is created';
