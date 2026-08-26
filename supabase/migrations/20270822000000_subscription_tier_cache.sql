-- Upgrade the private RevenueCat cache from a Premium boolean to the complete
-- subscription tier. The cache remains service-role-only and is never trusted
-- from a client request.

ALTER TABLE public.lotti_subscription_entitlements
  ADD COLUMN IF NOT EXISTS tier TEXT;

UPDATE public.lotti_subscription_entitlements
SET tier = 'premium'
WHERE is_premium = TRUE
  AND tier IS NULL;

ALTER TABLE public.lotti_subscription_entitlements
  DROP CONSTRAINT IF EXISTS lotti_subscription_entitlements_tier_check;

ALTER TABLE public.lotti_subscription_entitlements
  ADD CONSTRAINT lotti_subscription_entitlements_tier_check
  CHECK (tier IS NULL OR tier IN ('lite', 'standard', 'premium'));

CREATE INDEX IF NOT EXISTS lotti_subscription_entitlements_tier_idx
  ON public.lotti_subscription_entitlements(tier)
  WHERE tier IS NOT NULL;

COMMENT ON COLUMN public.lotti_subscription_entitlements.tier IS
  'Last server-verified RevenueCat tier. NULL forces a fresh verification.';
