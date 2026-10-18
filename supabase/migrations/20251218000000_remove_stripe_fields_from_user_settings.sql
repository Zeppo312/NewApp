-- Entfernt veraltete Stripe/Pro-Felder aus user_settings (RevenueCat wird clientseitig geprüft)
ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS is_pro,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_subscription_status,
  DROP COLUMN IF EXISTS stripe_current_period_end;

