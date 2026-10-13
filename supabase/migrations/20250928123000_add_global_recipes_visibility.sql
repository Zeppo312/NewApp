-- Add global visibility flag for BLW recipes and tighten access policies.

ALTER TABLE public.baby_recipes
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Replace public-read policy with scoped visibility.
DROP POLICY IF EXISTS "Allow anyone to read recipes" ON public.baby_recipes;

CREATE POLICY "Allow visible recipes"
  ON public.baby_recipes
  FOR SELECT
  USING (
    is_global = true
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.account_links links
      WHERE links.status = 'accepted'
        AND links.relationship_type = 'partner'
        AND (
          (links.creator_id = auth.uid() AND links.invited_id = baby_recipes.user_id)
          OR (links.invited_id = auth.uid() AND links.creator_id = baby_recipes.user_id)
        )
    )
  );

-- Ensure only admins can set recipes as global.
DROP POLICY IF EXISTS "Allow authenticated users to insert recipes" ON public.baby_recipes;
CREATE POLICY "Allow authenticated users to insert recipes"
  ON public.baby_recipes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      is_global = false
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_admin = true
      )
    )
  );

DROP POLICY IF EXISTS "Allow owners to update recipes" ON public.baby_recipes;
CREATE POLICY "Allow owners to update recipes"
  ON public.baby_recipes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      is_global = false
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_admin = true
      )
    )
  );
