-- BLW recipes are included in Lotti Lite as well as Standard and Premium.
BEGIN;

INSERT INTO public.subscription_plan_features (feature_key, plan_key, enabled)
VALUES ('recipes', 'lite', TRUE)
ON CONFLICT (feature_key, plan_key) DO UPDATE
SET enabled = TRUE,
    updated_at = clock_timestamp(),
    updated_by = NULL;

UPDATE public.subscription_policy_state
SET version = version + 1,
    updated_at = clock_timestamp(),
    updated_by = NULL
WHERE id = 'default';

COMMIT;
