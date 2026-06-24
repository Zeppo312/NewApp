CREATE TABLE IF NOT EXISTS public.subscription_cancellation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  details TEXT,
  source TEXT NOT NULL DEFAULT 'subscription_screen',
  platform TEXT,
  store TEXT,
  product_id TEXT,
  plan_type TEXT,
  expires_at TIMESTAMPTZ,
  will_renew BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_cancellation_feedback_user_id_idx
  ON public.subscription_cancellation_feedback(user_id);

CREATE INDEX IF NOT EXISTS subscription_cancellation_feedback_created_at_idx
  ON public.subscription_cancellation_feedback(created_at DESC);

ALTER TABLE public.subscription_cancellation_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own cancellation feedback"
  ON public.subscription_cancellation_feedback;
CREATE POLICY "Users can create own cancellation feedback"
  ON public.subscription_cancellation_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own cancellation feedback"
  ON public.subscription_cancellation_feedback;
CREATE POLICY "Users can view own cancellation feedback"
  ON public.subscription_cancellation_feedback
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view cancellation feedback"
  ON public.subscription_cancellation_feedback;
CREATE POLICY "Admins can view cancellation feedback"
  ON public.subscription_cancellation_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.is_admin = TRUE
    )
  );
