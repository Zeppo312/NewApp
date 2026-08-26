-- Adds the first independently configurable capability inside an existing
-- screen. The sleep tracker itself remains part of the base tracker; only its
-- monthly analysis can be assigned to subscription tiers separately.

INSERT INTO public.subscription_features (
  feature_key,
  display_name,
  description,
  sort_order,
  server_enforced
)
VALUES (
  'sleepMonthView',
  'Schlaftracker: Monatsansicht',
  'Monatliche Schlafauswertung und Kalenderansicht',
  85,
  FALSE
)
ON CONFLICT (feature_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    server_enforced = EXCLUDED.server_enforced,
    active = TRUE;

INSERT INTO public.subscription_plan_features (
  feature_key,
  plan_key,
  enabled
)
VALUES
  ('sleepMonthView', 'lite', FALSE),
  ('sleepMonthView', 'standard', TRUE),
  ('sleepMonthView', 'premium', TRUE)
ON CONFLICT (feature_key, plan_key) DO NOTHING;

-- A schema rollout is not an admin policy publication and therefore does not
-- create an audit entry attributed to a user. The version still changes so
-- connected clients immediately invalidate their published-policy snapshot.
UPDATE public.subscription_policy_state
SET version = version + 1,
    updated_at = clock_timestamp(),
    updated_by = NULL
WHERE id = 'default';
