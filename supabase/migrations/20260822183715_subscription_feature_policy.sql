-- Dynamic subscription feature policy.
--
-- The released app keeps an embedded last-known-safe matrix. These tables are
-- the authoritative published policy when reachable; a failed read never
-- changes client access. All writes are atomic and admin-only.

CREATE TABLE public.subscription_plans (
  plan_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order SMALLINT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_plans_key_check
    CHECK (plan_key IN ('lite', 'standard', 'premium'))
);

CREATE TABLE public.subscription_features (
  feature_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order SMALLINT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  server_enforced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.subscription_plan_features (
  feature_key TEXT NOT NULL
    REFERENCES public.subscription_features(feature_key) ON DELETE CASCADE,
  plan_key TEXT NOT NULL
    REFERENCES public.subscription_plans(plan_key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (feature_key, plan_key)
);

CREATE TABLE public.subscription_policy_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT subscription_policy_state_singleton CHECK (id = 'default')
);

CREATE TABLE public.subscription_policy_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version BIGINT NOT NULL CHECK (version >= 1),
  matrix JSONB NOT NULL CHECK (jsonb_typeof(matrix) = 'object'),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE INDEX subscription_plan_features_plan_key_idx
  ON public.subscription_plan_features(plan_key);
CREATE INDEX subscription_plan_features_updated_by_idx
  ON public.subscription_plan_features(updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX subscription_policy_state_updated_by_idx
  ON public.subscription_policy_state(updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX subscription_policy_audit_changed_by_idx
  ON public.subscription_policy_audit(changed_by);
CREATE INDEX subscription_policy_audit_changed_at_idx
  ON public.subscription_policy_audit(changed_at DESC);

INSERT INTO public.subscription_plans (plan_key, display_name, sort_order)
VALUES
  ('lite', 'Lotti Lite', 10),
  ('standard', 'Lotti Standard', 20),
  ('premium', 'Lotti Premium', 30);

INSERT INTO public.subscription_features (
  feature_key,
  display_name,
  description,
  sort_order,
  server_enforced
)
VALUES
  ('basisTracker', 'Basis-Tracker', 'Stillen, Schlafen, Flasche, Wickeln und Tagesübersicht', 10, FALSE),
  ('partnerLink', 'Partner-Verknüpfung', 'Gemeinsam dasselbe Baby verwalten und tracken', 20, FALSE),
  ('planner', 'Planer', 'Termine, Erinnerungen und gemeinsamer Kalender', 30, FALSE),
  ('shoppingList', 'Einkaufslisten', 'Listen, Vorräte, Warnungen und Kundenkarten', 40, FALSE),
  ('wochenmomente', 'Wochenmomente', 'Wöchentliche Erinnerungen und Sammlung', 50, FALSE),
  ('pdfExport', 'PDF-Export', 'Auswertungen, Berichte und Datenexport', 60, FALSE),
  ('recipes', 'Rezepte', 'Rezepte, Generator und Beikost-Inhalte', 70, FALSE),
  ('fullHistory', 'Kompletter Verlauf', 'Zugriff über die letzten sieben Tage hinaus', 80, FALSE),
  ('voiceLog', 'Sprach-Logging', 'Einträge per Spracheingabe erfassen', 90, TRUE),
  ('fuersorge', 'Lottis Fürsorge', 'Persönliche tägliche Hinweise', 100, TRUE),
  ('fragLotti', 'Frag Lotti', 'KI-Antworten mit passenden Lotti-Daten', 110, TRUE),
  ('pregnancyBriefing', 'Schwangerschafts-Briefing', 'Persönlicher täglicher Schwangerschaftsüberblick', 120, FALSE);

INSERT INTO public.subscription_plan_features (feature_key, plan_key, enabled)
SELECT feature.feature_key, plan.plan_key,
  CASE
    WHEN feature.feature_key = 'basisTracker' THEN TRUE
    WHEN feature.feature_key IN (
      'partnerLink', 'planner', 'shoppingList', 'wochenmomente',
      'pdfExport', 'recipes', 'fullHistory'
    ) THEN plan.plan_key IN ('standard', 'premium')
    ELSE plan.plan_key = 'premium'
  END
FROM public.subscription_features feature
CROSS JOIN public.subscription_plans plan;

INSERT INTO public.subscription_policy_state (id, version)
VALUES ('default', 1);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_policy_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_policy_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.subscription_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_features FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_plan_features FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_policy_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.subscription_policy_audit FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.subscription_plans TO anon, authenticated;
GRANT SELECT ON TABLE public.subscription_features TO anon, authenticated;
GRANT SELECT ON TABLE public.subscription_plan_features TO anon, authenticated;
GRANT SELECT ON TABLE public.subscription_policy_state TO anon, authenticated;
GRANT SELECT ON TABLE public.subscription_policy_audit TO authenticated;

CREATE POLICY subscription_plans_read_published
  ON public.subscription_plans
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY subscription_features_read_published
  ON public.subscription_features
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY subscription_plan_features_read_published
  ON public.subscription_plan_features
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY subscription_policy_state_read_published
  ON public.subscription_policy_state
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY subscription_policy_audit_admin_read
  ON public.subscription_policy_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.is_admin = TRUE
    )
  );

CREATE OR REPLACE FUNCTION public.get_subscription_feature_policy()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'policyVersion', state.version,
    'updatedAt', state.updated_at,
    'features', COALESCE(
      (
        SELECT jsonb_object_agg(
          feature.feature_key,
          COALESCE(
            (
              SELECT jsonb_agg(mapping.plan_key ORDER BY plan.sort_order)
              FROM public.subscription_plan_features mapping
              JOIN public.subscription_plans plan
                ON plan.plan_key = mapping.plan_key
              WHERE mapping.feature_key = feature.feature_key
                AND mapping.enabled = TRUE
                AND plan.active = TRUE
            ),
            '[]'::JSONB
          )
          ORDER BY feature.sort_order
        )
        FROM public.subscription_features feature
        WHERE feature.active = TRUE
      ),
      '{}'::JSONB
    )
  )
  FROM public.subscription_policy_state state
  WHERE state.id = 'default';
$$;

REVOKE ALL ON FUNCTION public.get_subscription_feature_policy()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscription_feature_policy()
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_publish_subscription_feature_policy(
  p_expected_version BIGINT,
  p_matrix JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_version BIGINT;
  next_version BIGINT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = current_user_id
      AND profile.is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_matrix) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'matrix must be a JSON object' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_matrix) supplied(feature_key)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.subscription_features feature
      WHERE feature.feature_key = supplied.feature_key
        AND feature.active = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'matrix contains an unknown feature' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscription_features feature
    WHERE feature.active = TRUE
      AND NOT (p_matrix ? feature.feature_key)
  ) THEN
    RAISE EXCEPTION 'matrix is missing an active feature' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_matrix) entry
    WHERE jsonb_typeof(entry.value) <> 'array'
  ) THEN
    RAISE EXCEPTION 'every feature value must be an array' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_matrix) entry
    WHERE jsonb_array_length(entry.value) <> (
      SELECT COUNT(DISTINCT supplied_plan.plan_key)
      FROM jsonb_array_elements_text(entry.value) supplied_plan(plan_key)
    )
  ) THEN
    RAISE EXCEPTION 'plan arrays must not contain duplicates' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_matrix) entry
    CROSS JOIN LATERAL jsonb_array_elements_text(entry.value) supplied_plan(plan_key)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.subscription_plans plan
      WHERE plan.plan_key = supplied_plan.plan_key
        AND plan.active = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'matrix contains an unknown plan' USING ERRCODE = '22023';
  END IF;

  SELECT state.version
  INTO STRICT current_version
  FROM public.subscription_policy_state state
  WHERE state.id = 'default'
  FOR UPDATE;

  IF current_version <> p_expected_version THEN
    RAISE EXCEPTION 'subscription policy version conflict'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.subscription_plan_features mapping
  SET enabled = (p_matrix -> mapping.feature_key) ? mapping.plan_key,
      updated_at = clock_timestamp(),
      updated_by = current_user_id;

  next_version := current_version + 1;

  UPDATE public.subscription_policy_state
  SET version = next_version,
      updated_at = clock_timestamp(),
      updated_by = current_user_id
  WHERE id = 'default';

  INSERT INTO public.subscription_policy_audit (
    version,
    matrix,
    changed_by
  )
  VALUES (next_version, p_matrix, current_user_id);

  RETURN public.get_subscription_feature_policy();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_subscription_feature_policy(BIGINT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_subscription_feature_policy(BIGINT, JSONB)
  TO authenticated, service_role;

COMMENT ON TABLE public.subscription_plan_features IS
  'Published dynamic mapping between app features and subscription plans.';
COMMENT ON FUNCTION public.get_subscription_feature_policy() IS
  'Returns the complete published feature matrix in one cacheable payload.';
COMMENT ON FUNCTION public.admin_publish_subscription_feature_policy(BIGINT, JSONB) IS
  'Atomically publishes a complete matrix with optimistic version checking and audit logging.';
