-- Einkauf und Vorräte is included in Lite. Preserve all other plan mappings.
-- Lock the policy version just like the admin publisher to serialize changes.
DO $$
BEGIN
  PERFORM 1 FROM public.subscription_policy_state
  WHERE id = 'default' FOR UPDATE;

  UPDATE public.subscription_plan_features
  SET enabled = TRUE,
      updated_at = clock_timestamp(),
      updated_by = NULL
  WHERE feature_key = 'shoppingList'
    AND plan_key = 'lite'
    AND enabled = FALSE;

  IF FOUND THEN
    UPDATE public.subscription_policy_state
    SET version = version + 1,
        updated_at = clock_timestamp(),
        updated_by = NULL
    WHERE id = 'default';
  END IF;
END;
$$;
