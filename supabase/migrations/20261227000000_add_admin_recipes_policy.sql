-- Allow admins to update BLW recipes.
ALTER TABLE public.baby_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins to update recipes" ON public.baby_recipes;

CREATE POLICY "Allow admins to update recipes"
  ON public.baby_recipes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );
