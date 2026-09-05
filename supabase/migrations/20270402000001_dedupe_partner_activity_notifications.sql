-- Harden partner activity notifications in production.
-- Goals:
-- 1. Preserve the existing "partner had a push token before the entry existed" guard.
-- 2. Prevent duplicate partner notifications for the same source entry.
-- 3. Skip historical backfills/manual backdating that would otherwise create fresh partner pushes
--    for events that happened long ago.

-- Safety cleanup before adding the unique index.
WITH ranked_notifications AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, partner_id, activity_type, entry_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM public.partner_activity_notifications
  WHERE entry_id IS NOT NULL
)
DELETE FROM public.partner_activity_notifications
WHERE id IN (
  SELECT id
  FROM ranked_notifications
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_notifications_entry_unique
  ON public.partner_activity_notifications(user_id, partner_id, activity_type, entry_id)
  WHERE entry_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_partner_sleep_notification()
RETURNS TRIGGER AS $function$
DECLARE
  partner_user_id UUID;
  partner_token_created_at TIMESTAMP WITH TIME ZONE;
  effective_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  effective_created_at := COALESCE(NEW.created_at, NOW());

  -- Log that trigger was called
  RAISE NOTICE 'Sleep trigger fired for entry: %, user: %', NEW.id, NEW.user_id;

  -- Get partner ID from account_links table
  SELECT CASE
    WHEN creator_id = NEW.user_id THEN invited_id
    ELSE creator_id
  END INTO partner_user_id
  FROM public.account_links
  WHERE status = 'accepted'
    AND relationship_type = 'partner'
    AND (creator_id = NEW.user_id OR invited_id = NEW.user_id)
  LIMIT 1;

  -- Log partner lookup result
  RAISE NOTICE 'Partner lookup result: %', partner_user_id;

  -- If no partner exists, exit early
  IF partner_user_id IS NULL THEN
    RAISE NOTICE 'No partner found, exiting';
    RETURN NEW;
  END IF;

  -- Check if partner has a push token that was created BEFORE this entry
  SELECT MIN(created_at) INTO partner_token_created_at
  FROM public.user_push_tokens
  WHERE user_id = partner_user_id;

  IF partner_token_created_at IS NULL THEN
    RAISE NOTICE 'Partner has no push token, skipping notification';
    RETURN NEW;
  END IF;

  IF partner_token_created_at > effective_created_at THEN
    RAISE NOTICE 'Partner push token (%) was created after this entry (%), skipping notification',
      partner_token_created_at, effective_created_at;
    RETURN NEW;
  END IF;

  -- Historical backfills/manual backdating should not wake the partner up with a fresh push.
  IF NEW.start_time < effective_created_at - INTERVAL '2 hours' THEN
    RAISE NOTICE 'Sleep entry is historical (start: %, created: %), skipping notification',
      NEW.start_time, effective_created_at;
    RETURN NEW;
  END IF;

  -- Log before insert
  RAISE NOTICE 'Inserting notification for partner: % (token created: %, entry created: %, start: %)',
    partner_user_id, partner_token_created_at, effective_created_at, NEW.start_time;

  INSERT INTO public.partner_activity_notifications (
    user_id,
    partner_id,
    activity_type,
    activity_subtype,
    entry_id,
    is_read,
    created_at
  ) VALUES (
    partner_user_id,
    NEW.user_id,
    'sleep',
    NULL,
    NEW.id,
    false,
    NOW()
  )
  ON CONFLICT (user_id, partner_id, activity_type, entry_id) WHERE entry_id IS NOT NULL DO NOTHING;

  RAISE NOTICE 'Notification created successfully';

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in trigger: %', SQLERRM;
    RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_partner_care_notification()
RETURNS TRIGGER AS $function$
DECLARE
  partner_user_id UUID;
  activity_subtype_value TEXT;
  partner_token_created_at TIMESTAMP WITH TIME ZONE;
  effective_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  effective_created_at := COALESCE(NEW.created_at, NOW());

  -- Log that trigger was called
  RAISE NOTICE 'Care trigger fired for entry: %, user: %, type: %', NEW.id, NEW.user_id, NEW.entry_type;

  -- Get partner ID from account_links table
  SELECT CASE
    WHEN creator_id = NEW.user_id THEN invited_id
    ELSE creator_id
  END INTO partner_user_id
  FROM public.account_links
  WHERE status = 'accepted'
    AND relationship_type = 'partner'
    AND (creator_id = NEW.user_id OR invited_id = NEW.user_id)
  LIMIT 1;

  -- Log partner lookup result
  RAISE NOTICE 'Partner lookup result: %', partner_user_id;

  -- If no partner exists, exit early
  IF partner_user_id IS NULL THEN
    RAISE NOTICE 'No partner found, exiting';
    RETURN NEW;
  END IF;

  -- Check if partner has a push token that was created BEFORE this entry
  SELECT MIN(created_at) INTO partner_token_created_at
  FROM public.user_push_tokens
  WHERE user_id = partner_user_id;

  IF partner_token_created_at IS NULL THEN
    RAISE NOTICE 'Partner has no push token, skipping notification';
    RETURN NEW;
  END IF;

  IF partner_token_created_at > effective_created_at THEN
    RAISE NOTICE 'Partner push token (%) was created after this entry (%), skipping notification',
      partner_token_created_at, effective_created_at;
    RETURN NEW;
  END IF;

  -- Historical backfills/manual backdating should not create a fresh partner push.
  IF NEW.start_time < effective_created_at - INTERVAL '2 hours' THEN
    RAISE NOTICE 'Care entry is historical (start: %, created: %), skipping notification',
      NEW.start_time, effective_created_at;
    RETURN NEW;
  END IF;

  -- Determine subtype based on entry type
  IF NEW.entry_type = 'feeding' THEN
    activity_subtype_value := NEW.feeding_type::TEXT;
  ELSIF NEW.entry_type = 'diaper' THEN
    activity_subtype_value := NEW.diaper_type::TEXT;
  ELSE
    activity_subtype_value := NULL;
  END IF;

  -- Log before insert
  RAISE NOTICE 'Inserting notification for partner: %, subtype: % (token created: %, entry created: %, start: %)',
    partner_user_id, activity_subtype_value, partner_token_created_at, effective_created_at, NEW.start_time;

  INSERT INTO public.partner_activity_notifications (
    user_id,
    partner_id,
    activity_type,
    activity_subtype,
    entry_id,
    is_read,
    created_at
  ) VALUES (
    partner_user_id,
    NEW.user_id,
    NEW.entry_type::TEXT,
    activity_subtype_value,
    NEW.id,
    false,
    NOW()
  )
  ON CONFLICT (user_id, partner_id, activity_type, entry_id) WHERE entry_id IS NOT NULL DO NOTHING;

  RAISE NOTICE 'Notification created successfully';

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in trigger: %', SQLERRM;
    RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_partner_sleep_notification IS
  'Trigger function that keeps the token-time guard, skips historical sleep backfills, and deduplicates partner notifications';

COMMENT ON FUNCTION public.create_partner_care_notification IS
  'Trigger function that keeps the token-time guard, skips historical care backfills, and deduplicates partner notifications';
