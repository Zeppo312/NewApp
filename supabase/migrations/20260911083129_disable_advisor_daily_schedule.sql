-- Retire only the daily Care schedule; preserve it for audit/rollback.
-- No user records or unrelated reminders are changed.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    UPDATE cron.job
       SET active = false
     WHERE jobname = 'advisor-daily'
        OR command LIKE '%/functions/v1/advisor-daily%';
  END IF;
END;
$$;
