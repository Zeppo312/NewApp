-- Fix recursive RLS on baby_members by using a SECURITY DEFINER helper.

CREATE OR REPLACE FUNCTION public.is_baby_member(p_baby_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.baby_members bm
    WHERE bm.baby_id = p_baby_id
      AND bm.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Baby members: select by member" ON public.baby_members;
CREATE POLICY "Baby members: select by member" ON public.baby_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.baby_info bi
      WHERE bi.id = baby_members.baby_id
        AND bi.user_id = auth.uid()
    )
    OR public.is_baby_member(baby_members.baby_id)
  );
