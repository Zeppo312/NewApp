-- Scheduled push notifications for baby reminders (sleep window + feeding)
-- Enables reminder delivery even when the mobile app is closed.

CREATE TABLE IF NOT EXISTS public.baby_reminder_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID REFERENCES public.baby_info(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('sleep_window', 'feeding')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  schedule_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  cancelled BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT baby_reminder_notifications_user_baby_type_unique
    UNIQUE (user_id, baby_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_baby_reminder_notifications_due
  ON public.baby_reminder_notifications(scheduled_for)
  WHERE sent = false AND cancelled = false;

CREATE INDEX IF NOT EXISTS idx_baby_reminder_notifications_user
  ON public.baby_reminder_notifications(user_id);

ALTER TABLE public.baby_reminder_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS baby_reminder_notifications_select_own ON public.baby_reminder_notifications;
CREATE POLICY baby_reminder_notifications_select_own
  ON public.baby_reminder_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS baby_reminder_notifications_insert_own ON public.baby_reminder_notifications;
CREATE POLICY baby_reminder_notifications_insert_own
  ON public.baby_reminder_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS baby_reminder_notifications_update_own ON public.baby_reminder_notifications;
CREATE POLICY baby_reminder_notifications_update_own
  ON public.baby_reminder_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS baby_reminder_notifications_delete_own ON public.baby_reminder_notifications;
CREATE POLICY baby_reminder_notifications_delete_own
  ON public.baby_reminder_notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_baby_reminder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_baby_reminder_updated_at ON public.baby_reminder_notifications;
CREATE TRIGGER trigger_set_baby_reminder_updated_at
  BEFORE UPDATE ON public.baby_reminder_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_baby_reminder_updated_at();

CREATE OR REPLACE FUNCTION public.send_baby_reminder_notification_webhook()
RETURNS TRIGGER AS $$
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
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_send_baby_reminder_notification_webhook ON public.baby_reminder_notifications;
CREATE TRIGGER trigger_send_baby_reminder_notification_webhook
  AFTER INSERT OR UPDATE ON public.baby_reminder_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_baby_reminder_notification_webhook();

CREATE OR REPLACE FUNCTION public.check_due_baby_reminder_notifications()
RETURNS void AS $$
DECLARE
  reminder_record RECORD;
BEGIN
  FOR reminder_record IN
    SELECT id
    FROM public.baby_reminder_notifications
    WHERE sent = false
      AND cancelled = false
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT 100
  LOOP
    UPDATE public.baby_reminder_notifications
    SET updated_at = now()
    WHERE id = reminder_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.baby_reminder_notifications TO authenticated;

COMMENT ON TABLE public.baby_reminder_notifications IS 'Stores next scheduled baby reminder push notifications (feeding/sleep window)';
COMMENT ON FUNCTION public.send_baby_reminder_notification_webhook IS 'Sends webhook to Edge Function for due baby reminder notifications';
COMMENT ON FUNCTION public.check_due_baby_reminder_notifications IS 'Checks due baby reminders and triggers webhook flow (schedule via pg_cron)';

-- Auto-register cron job when pg_cron is available.
DO $$
DECLARE
  cron_job_exists BOOLEAN := false;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'check-baby-reminder-notifications'
      )
    $sql$
    INTO cron_job_exists;

    IF NOT cron_job_exists THEN
      EXECUTE $sql$
        SELECT cron.schedule(
          'check-baby-reminder-notifications',
          '* * * * *',
          'SELECT public.check_due_baby_reminder_notifications()'
        )
      $sql$;
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available. Schedule manually: SELECT public.check_due_baby_reminder_notifications() every minute.';
  END IF;
END;
$$;
