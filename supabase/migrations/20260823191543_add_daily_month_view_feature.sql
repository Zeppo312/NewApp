-- Adds an independently configurable monthly analysis inside "Unser Tag".
-- Day and week tracking remain available through the base tracker.

INSERT INTO public.subscription_features (
  feature_key,
  display_name,
  description,
  sort_order,
  server_enforced
)
VALUES (
  'dailyMonthView',
  'Unser Tag: Monatsansicht',
  'Monatlicher Aktivitätskalender für Füttern und Wickeln',
  87,
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
  ('dailyMonthView', 'lite', FALSE),
  ('dailyMonthView', 'standard', TRUE),
  ('dailyMonthView', 'premium', TRUE)
ON CONFLICT (feature_key, plan_key) DO NOTHING;

UPDATE public.subscription_policy_state
SET version = version + 1,
    updated_at = clock_timestamp(),
    updated_by = NULL
WHERE id = 'default';
ä