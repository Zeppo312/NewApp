ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS sleep_window_notifications_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS feeding_notifications_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS vitamin_d_reminder_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS vitamin_d_reminder_hour INTEGER DEFAULT 9,
  ADD COLUMN IF NOT EXISTS vitamin_d_reminder_minute INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_notifications_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS planner_notifications_enabled BOOLEAN DEFAULT TRUE;

UPDATE user_settings
SET
  sleep_window_notifications_enabled = COALESCE(sleep_window_notifications_enabled, TRUE),
  feeding_notifications_enabled = COALESCE(feeding_notifications_enabled, TRUE),
  vitamin_d_reminder_enabled = COALESCE(vitamin_d_reminder_enabled, TRUE),
  vitamin_d_reminder_hour = COALESCE(vitamin_d_reminder_hour, 9),
  vitamin_d_reminder_minute = COALESCE(vitamin_d_reminder_minute, 0),
  partner_notifications_enabled = COALESCE(partner_notifications_enabled, TRUE),
  planner_notifications_enabled = COALESCE(planner_notifications_enabled, TRUE);

ALTER TABLE user_settings
  ALTER COLUMN sleep_window_notifications_enabled SET DEFAULT TRUE,
  ALTER COLUMN feeding_notifications_enabled SET DEFAULT TRUE,
  ALTER COLUMN vitamin_d_reminder_enabled SET DEFAULT TRUE,
  ALTER COLUMN vitamin_d_reminder_hour SET DEFAULT 9,
  ALTER COLUMN vitamin_d_reminder_minute SET DEFAULT 0,
  ALTER COLUMN partner_notifications_enabled SET DEFAULT TRUE,
  ALTER COLUMN planner_notifications_enabled SET DEFAULT TRUE;

ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_vitamin_d_reminder_hour_check
    CHECK (vitamin_d_reminder_hour BETWEEN 0 AND 23),
  ADD CONSTRAINT user_settings_vitamin_d_reminder_minute_check
    CHECK (vitamin_d_reminder_minute BETWEEN 0 AND 59);

COMMENT ON COLUMN user_settings.sleep_window_notifications_enabled IS 'Enables local and remote sleep window reminders.';
COMMENT ON COLUMN user_settings.feeding_notifications_enabled IS 'Enables local and remote feeding reminders.';
COMMENT ON COLUMN user_settings.vitamin_d_reminder_enabled IS 'Enables the daily local Vitamin D reminder.';
COMMENT ON COLUMN user_settings.vitamin_d_reminder_hour IS 'Hour for the daily Vitamin D reminder.';
COMMENT ON COLUMN user_settings.vitamin_d_reminder_minute IS 'Minute for the daily Vitamin D reminder.';
COMMENT ON COLUMN user_settings.partner_notifications_enabled IS 'Enables partner activity push notifications.';
COMMENT ON COLUMN user_settings.planner_notifications_enabled IS 'Enables planner push notifications.';
