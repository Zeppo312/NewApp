-- Exact current production notification senders; no message or deletion test.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $gate$ BEGIN
IF md5(pg_get_functiondef('public.send_baby_reminder_notification_webhook()'::regprocedure)) IS DISTINCT FROM '1b290dec5fdc01e47fc68a155f423c2c' THEN RAISE EXCEPTION 'notification_sender_body_changed'; END IF;
IF md5(pg_get_functiondef('public.send_direct_message_notification_webhook()'::regprocedure)) IS DISTINCT FROM '265403971891d5fd8f6ea4a1a2d4e90e' THEN RAISE EXCEPTION 'notification_sender_body_changed'; END IF;
IF md5(pg_get_functiondef('public.send_group_message_notification_webhook()'::regprocedure)) IS DISTINCT FROM '8122cf8903ecb912fdd67c4668d35fb3' THEN RAISE EXCEPTION 'notification_sender_body_changed'; END IF;
IF md5(pg_get_functiondef('public.send_partner_notification_webhook()'::regprocedure)) IS DISTINCT FROM '9939a00a5f78ae7aa7a67d2e2f9a8611' THEN RAISE EXCEPTION 'notification_sender_body_changed'; END IF;
IF md5(pg_get_functiondef('public.send_planner_notification_webhook()'::regprocedure)) IS DISTINCT FROM 'd17503815b8bb8a95f550fe964cd34ae' THEN RAISE EXCEPTION 'notification_sender_body_changed'; END IF;
END $gate$;
CREATE FUNCTION deletion_private.notification_headers() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text; BEGIN
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='lottibaby_notification_webhook_secret';
 IF token IS NULL OR length(token)<32 THEN RAISE EXCEPTION 'notification_secret_missing'; END IF;
 RETURN jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token);
END $$;
REVOKE ALL ON FUNCTION deletion_private.notification_headers() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.send_baby_reminder_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  webhook_url TEXT;
  request_id BIGINT;
  baby_name TEXT;
BEGIN
  IF NEW.sent = false AND NEW.cancelled = false AND NEW.scheduled_for <= now() THEN
    IF NEW.baby_id IS NOT NULL THEN
      SELECT name INTO baby_name
      FROM public.baby_info
      WHERE id = NEW.baby_id;
    END IF;

    webhook_url := 'https://kwniiyayhzgjfqjsjcfu.supabase.co/functions/v1/send-baby-reminder-notification';

    SELECT net.http_post(
      url := webhook_url,
      headers := deletion_private.notification_headers(),
      body := jsonb_build_object(
        'type', 'baby_reminder_notification',
        'notification', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'baby_id', NEW.baby_id,
          'baby_name', baby_name,
          'reminder_type', NEW.reminder_type,
          'scheduled_for', NEW.scheduled_for,
          'title', NEW.title,
          'body', NEW.body,
          'schedule_key', NEW.schedule_key,
          'payload', NEW.payload
        )
      )
    ) INTO request_id;

    UPDATE public.baby_reminder_notifications
    SET sent = true, sent_at = now(), cancelled = false, cancelled_at = NULL
    WHERE id = NEW.id;

    RAISE NOTICE 'Baby reminder webhook sent with request_id: %', request_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send baby reminder webhook: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.send_direct_message_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  supabase_base_url text;
  webhook_url text;
  webhook_secret text;
  request_id bigint;
BEGIN
  supabase_base_url := nullif(current_setting('app.settings.supabase_url', true), '');
  webhook_secret := (deletion_private.notification_headers()->>'Authorization');

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
      'Authorization', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'direct_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'sender_id', NEW.sender_id,
        'receiver_id', NEW.receiver_id,
        'content', NEW.content,
        'message_type', NEW.message_type,
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
$function$
;
CREATE OR REPLACE FUNCTION public.send_group_message_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  supabase_base_url text;
  webhook_url text;
  webhook_secret text;
  request_id bigint;
BEGIN
  supabase_base_url := nullif(current_setting('app.settings.supabase_url', true), '');
  webhook_secret := (deletion_private.notification_headers()->>'Authorization');

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
      'Authorization', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'community_group_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'group_id', NEW.group_id,
        'sender_id', NEW.sender_id,
        'content', NEW.content,
        'message_type', NEW.message_type,
        'event_id', NEW.event_id,
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
$function$
;
CREATE OR REPLACE FUNCTION public.send_partner_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    headers := deletion_private.notification_headers(),
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
$function$
;
CREATE OR REPLACE FUNCTION public.send_planner_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      headers := deletion_private.notification_headers(),
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
$function$
;
COMMIT;
