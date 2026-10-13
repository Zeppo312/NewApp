-- Run after deploying reconcile-family-subscriptions. Requires existing pg_cron,
-- pg_net and Vault secrets: supabase_url, subscription_reconcile_secret.
-- The latter must equal the Edge secret SUBSCRIPTION_RECONCILE_SECRET.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='supabase_url') OR
     NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='subscription_reconcile_secret') THEN
    RAISE EXCEPTION 'Configure subscription reconciliation Vault secrets first';
  END IF;
END $$;
SELECT cron.schedule('family-subscription-rechecks','* * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='supabase_url') || '/functions/v1/reconcile-family-subscriptions',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='subscription_reconcile_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000
  );
$job$);
