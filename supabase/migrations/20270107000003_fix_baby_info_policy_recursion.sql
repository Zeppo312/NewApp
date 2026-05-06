-- Break RLS recursion between baby_info and baby_members.

CREATE OR REPLACE FUNCTION public.is_baby_member(p_baby_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.baby_members bm
    WHERE bm.baby_id = p_baby_id
      AND bm.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Baby info: select by member" ON public.baby_info;
DROP POLICY IF EXISTS "Baby info: update by member" ON public.baby_info;
DROP POLICY IF EXISTS "Baby info: delete by member" ON public.baby_info;

CREATE POLICY "Baby info: select by member" ON public.baby_info
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_baby_member(baby_info.id)
  );

CREATE POLICY "Baby info: update by member" ON public.baby_info
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_baby_member(baby_info.id)
  );

CREATE POLICY "Baby info: delete by member" ON public.baby_info
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_baby_member(baby_info.id)
  );
