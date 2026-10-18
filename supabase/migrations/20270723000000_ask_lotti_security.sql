-- "Frag Lotti": private server-side subscription state, atomic quotas and
-- privacy-preserving request metadata. None of these tables is readable from
-- the app. The service role is used only inside trusted Edge Functions.

CREATE TABLE IF NOT EXISTS public.lotti_subscription_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  product_id TEXT,
  expires_at TIMESTAMPTZ,
  source TEXT NOT NULL CHECK (source IN ('revenuecat_api', 'revenuecat_webhook')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lotti_revenuecat_webhook_events (
  event_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_code TEXT
);

CREATE TABLE IF NOT EXISTS public.lotti_ai_usage_buckets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('ask_lotti')),
  window_kind TEXT NOT NULL CHECK (window_kind IN ('minute', 'day', 'month')),
  window_start TIMESTAMPTZ NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, feature, window_kind, window_start)
);

CREATE TABLE IF NOT EXISTS public.lotti_ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID REFERENCES public.baby_info(id) ON DELETE SET NULL,
  request_id UUID NOT NULL,
  feature TEXT NOT NULL CHECK (feature IN ('ask_lotti')),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'completed', 'rejected', 'failed')),
  route TEXT,
  intent TEXT,
  classifier_model TEXT,
  answer_model TEXT,
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT lotti_ai_requests_route_check
    CHECK (route IS NULL OR route IN ('regex_direct', 'model', 'fallback')),
  UNIQUE (user_id, request_id)
);

-- The table may already exist because the first Ask Lotti version was rolled
-- out manually. Keep this migration safe for that upgrade path as well.
ALTER TABLE public.lotti_ai_requests
  ADD COLUMN IF NOT EXISTS route TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.lotti_ai_requests'::regclass
      AND conname = 'lotti_ai_requests_route_check'
  ) THEN
    ALTER TABLE public.lotti_ai_requests
      ADD CONSTRAINT lotti_ai_requests_route_check
      CHECK (route IS NULL OR route IN ('regex_direct', 'model', 'fallback'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lotti_ai_usage_buckets_expiry_idx
  ON public.lotti_ai_usage_buckets (expires_at);
CREATE INDEX IF NOT EXISTS lotti_ai_requests_user_created_idx
  ON public.lotti_ai_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lotti_ai_requests_route_created_idx
  ON public.lotti_ai_requests (route, created_at DESC)
  WHERE route IS NOT NULL;
CREATE INDEX IF NOT EXISTS lotti_revenuecat_events_received_idx
  ON public.lotti_revenuecat_webhook_events (received_at DESC);

ALTER TABLE public.lotti_subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotti_revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotti_ai_usage_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotti_ai_requests ENABLE ROW LEVEL SECURITY;

-- Deliberately no RLS policies: authenticated/anonymous clients get no rows.
REVOKE ALL ON public.lotti_subscription_entitlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lotti_revenuecat_webhook_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lotti_ai_usage_buckets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lotti_ai_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_lotti_ai_quota(
  p_user_id UUID,
  p_baby_id UUID,
  p_request_id UUID,
  p_feature TEXT DEFAULT 'ask_lotti'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_minute_start TIMESTAMPTZ := date_trunc('minute', v_now);
  v_day_start TIMESTAMPTZ := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_start TIMESTAMPTZ := date_trunc('month', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used INTEGER;
  v_existing_status TEXT;
BEGIN
  IF p_feature <> 'ask_lotti' THEN
    RAISE EXCEPTION 'unsupported feature';
  END IF;

  -- Serialize quota consumption per user and feature. This prevents parallel
  -- requests from passing a count-then-insert race.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':' || p_feature, 0));

  SELECT status INTO v_existing_status
  FROM public.lotti_ai_requests
  WHERE user_id = p_user_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'duplicate_request',
      'requestStatus', v_existing_status
    );
  END IF;

  SELECT used INTO v_used
  FROM public.lotti_ai_usage_buckets
  WHERE user_id = p_user_id AND feature = p_feature
    AND window_kind = 'minute' AND window_start = v_minute_start;
  IF COALESCE(v_used, 0) >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'rate_limit', 'window', 'minute', 'retryAt', v_minute_start + INTERVAL '1 minute');
  END IF;

  SELECT used INTO v_used
  FROM public.lotti_ai_usage_buckets
  WHERE user_id = p_user_id AND feature = p_feature
    AND window_kind = 'day' AND window_start = v_day_start;
  IF COALESCE(v_used, 0) >= 20 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'rate_limit', 'window', 'day', 'retryAt', v_day_start + INTERVAL '1 day');
  END IF;

  SELECT used INTO v_used
  FROM public.lotti_ai_usage_buckets
  WHERE user_id = p_user_id AND feature = p_feature
    AND window_kind = 'month' AND window_start = v_month_start;
  IF COALESCE(v_used, 0) >= 300 THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'rate_limit', 'window', 'month', 'retryAt', v_month_start + INTERVAL '1 month');
  END IF;

  INSERT INTO public.lotti_ai_usage_buckets (user_id, feature, window_kind, window_start, used, expires_at)
  VALUES
    (p_user_id, p_feature, 'minute', v_minute_start, 1, v_minute_start + INTERVAL '2 minutes'),
    (p_user_id, p_feature, 'day', v_day_start, 1, v_day_start + INTERVAL '2 days'),
    (p_user_id, p_feature, 'month', v_month_start, 1, v_month_start + INTERVAL '2 months')
  ON CONFLICT (user_id, feature, window_kind, window_start)
  DO UPDATE SET used = public.lotti_ai_usage_buckets.used + 1;

  INSERT INTO public.lotti_ai_requests (
    user_id, baby_id, request_id, feature, status
  ) VALUES (
    p_user_id, p_baby_id, p_request_id, p_feature, 'accepted'
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', jsonb_build_object(
      'minute', 2 - COALESCE((SELECT used FROM public.lotti_ai_usage_buckets WHERE user_id = p_user_id AND feature = p_feature AND window_kind = 'minute' AND window_start = v_minute_start), 1) + 1,
      'day', 19 - COALESCE((SELECT used FROM public.lotti_ai_usage_buckets WHERE user_id = p_user_id AND feature = p_feature AND window_kind = 'day' AND window_start = v_day_start), 1) + 1,
      'month', 299 - COALESCE((SELECT used FROM public.lotti_ai_usage_buckets WHERE user_id = p_user_id AND feature = p_feature AND window_kind = 'month' AND window_start = v_month_start), 1) + 1
    ),
    'resetsAt', jsonb_build_object(
      'minute', v_minute_start + INTERVAL '1 minute',
      'day', v_day_start + INTERVAL '1 day',
      'month', v_month_start + INTERVAL '1 month'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_lotti_ai_quota(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_lotti_ai_quota(UUID, UUID, UUID, TEXT) TO service_role;

COMMENT ON TABLE public.lotti_ai_requests IS
  'Metadata only. Raw questions, model answers and family data must never be stored here.';
COMMENT ON FUNCTION public.consume_lotti_ai_quota(UUID, UUID, UUID, TEXT) IS
  'Atomically enforces 3/minute, 20/day and 300/month for Frag Lotti. Service-role only.';
